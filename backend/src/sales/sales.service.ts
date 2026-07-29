import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { toYmd } from '../common/utils/to-ymd.util';
import { buildSalesSummaryListModel } from './sales-summary-list-model.util';
import { buildActiveSalesSummaryShiftDuplicateWhere } from './sales-summary-duplicate.util';
import { SalesDashboardPackService } from './sales-dashboard-pack.service';
import { dailySalesSummaryListInclude } from './sales-summary-query.util';

type SalesShift = 'morning' | 'evening' | 'all';
type SalesChannelInput = { vaultId: string; amount: string };

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly financialCore: FinancialCoreService,
    private readonly dashboardPack: SalesDashboardPackService,
  ) {}

  async createSummary(dto: {
    companyId: string;
    transactionDate: string;
    customerCount: number;
    shift?: SalesShift;
    cashOnHand: string;
    channels: SalesChannelInput[];
    notes?: string;
    idempotencyKey?: string;
    userId?: string;
  }) {
    const result = await this.financialCore.processInflow(
      {
        companyId: dto.companyId,
        transactionDate: dto.transactionDate,
        customerCount: dto.customerCount,
        shift: dto.shift,
        cashOnHand: dto.cashOnHand,
        channels: dto.channels,
        notes: dto.notes,
        idempotencyKey: dto.idempotencyKey,
      },
      dto.userId,
    );
    const summary = await this.loadSummaryWithChannels(result.summary.id, dto.companyId);
    return { ...result, summary: summary ?? result.summary };
  }

  async createSummaryBatch(dto: {
    companyId: string;
    transactionDate: string;
    items: Array<{
      shift: SalesShift;
      customerCount: number;
      cashOnHand?: string;
      channels: SalesChannelInput[];
      notes?: string;
    }>;
    batchIdempotencyKey?: string;
    userId?: string;
  }) {
    const inflowDtos = dto.items.map((item) => ({
      companyId: dto.companyId,
      transactionDate: dto.transactionDate,
      customerCount: item.customerCount,
      shift: item.shift,
      cashOnHand: item.cashOnHand ?? '0',
      channels: item.channels,
      notes: item.notes,
    }));
    const batch = await this.financialCore.processInflowBatch(
      inflowDtos,
      dto.userId,
      dto.batchIdempotencyKey,
    );
    const summaries = await Promise.all(
      (batch.summaries || []).map(async (summary) => {
        const full = await this.loadSummaryWithChannels(summary.id, dto.companyId);
        return full ?? summary;
      }),
    );
    return { ...batch, summaries };
  }

  async findDashboardPack(
    companyId: string,
    ranges: {
      yearStart: string;
      yearEnd: string;
      dailyStart?: string | null;
      dailyEnd?: string | null;
      monthStart?: string | null;
      monthEnd?: string | null;
      baselineStart?: string | null;
      baselineEnd?: string | null;
    },
    includeCancelled = false,
  ) {
    return this.dashboardPack.findDashboardPack(companyId, ranges, includeCancelled);
  }

  async findAll(
    companyId: string,
    startDate?: string,
    endDate?: string,
    page = 1,
    pageSize = 30,
    q?: string,
    sortBy = 'transactionDate',
    sortDir: 'asc' | 'desc' | string = 'desc',
    includeCancelled = false,
    shift?: string,
  ) {
    const whereWithShift = this.buildFindAllWhere(companyId, startDate, endDate, q, includeCancelled, shift);
    const orderBy = this.buildFindAllOrderBy(sortBy, sortDir);
    const size = Math.min(200, Math.max(1, pageSize));
    const p = Math.max(1, page);

    const [items, total] = await Promise.all([
      this.prisma.dailySalesSummary.findMany({
        where: whereWithShift,
        orderBy,
        skip: (p - 1) * size,
        take: size,
        include: dailySalesSummaryListInclude(),
      }),
      this.prisma.dailySalesSummary.count({ where: whereWithShift }),
    ]);

    const model = buildSalesSummaryListModel(items);
    return { ...model, total, page: p, pageSize: size };
  }

  async patchSummaryShift(id: string, companyId: string, shift: SalesShift) {
    const summary = await this.prisma.dailySalesSummary.findFirst({
      where: { id, companyId, status: 'active' },
      select: { id: true, transactionDate: true },
    });
    if (!summary) throw new NotFoundException('الملخص غير موجود أو تم إلغاؤه.');

    const duplicate = await this.prisma.dailySalesSummary.findFirst({
      where: buildActiveSalesSummaryShiftDuplicateWhere({
        companyId,
        transactionDate: summary.transactionDate,
        shift,
        excludeId: id,
      }),
      select: { summaryNumber: true },
    });
    if (duplicate) {
      throw new BadRequestException(
        'يوجد ملخص مبيعات نشط لنفس التاريخ والشفت. ألغِ الملخص السابق أو عدّله بدلاً من إنشاء مكرر.',
      );
    }

    const updated = await this.prisma.dailySalesSummary.updateMany({
      where: { id, companyId, status: 'active' },
      data: { shift },
    });
    if (updated.count === 0) throw new NotFoundException('الملخص غير موجود أو تم إلغاؤه.');
    return { ok: true, shift };
  }

  async updateSummary(
    id: string,
    companyId: string,
    dto: {
      transactionDate?: string;
      customerCount?: number;
      shift?: SalesShift;
      cashOnHand?: string;
      channels?: SalesChannelInput[];
      notes?: string;
    },
    userId?: string,
  ) {
    const summary = await this.prisma.dailySalesSummary.findFirst({
      where: { id, companyId, status: 'active' },
      include: { channels: true },
    });
    if (!summary) throw new NotFoundException('الملخص غير موجود أو تم إلغاؤه.');
    if (!dto.channels?.length) throw new BadRequestException('يجب إدخال قناة بيع واحدة على الأقل.');

    const totalAmount = dto.channels.reduce(
      (sum, channel) => sum.plus(new Prisma.Decimal(channel.amount || '0')),
      new Prisma.Decimal(0),
    );
    if (totalAmount.lte(0)) throw new BadRequestException('يجب أن يكون إجمالي المبيعات أكبر من صفر.');

    return this.financialCore.updateInflow(
      id,
      companyId,
      {
        transactionDate: dto.transactionDate ?? toYmd(summary.transactionDate),
        customerCount: dto.customerCount ?? summary.customerCount,
        shift: dto.shift ?? ((summary as { shift?: SalesShift }).shift ?? 'all'),
        cashOnHand: dto.cashOnHand ?? String(summary.cashOnHand),
        channels: dto.channels,
        notes: dto.notes ?? summary.notes ?? undefined,
      },
      userId,
    );
  }

  async cancelSummary(id: string, companyId: string, userId?: string) {
    return this.financialCore.cancelOperation(
      { referenceType: 'sale', referenceId: id, companyId, reason: 'إلغاء من واجهة المبيعات' },
      userId,
    );
  }

  private async loadSummaryWithChannels(id: string, companyId: string) {
    return this.prisma.dailySalesSummary.findFirst({
      where: { id, companyId },
      include: dailySalesSummaryListInclude(),
    });
  }

  private buildFindAllWhere(
    companyId: string,
    startDate?: string,
    endDate?: string,
    q?: string,
    includeCancelled = false,
    shift?: string,
  ): Prisma.DailySalesSummaryWhereInput {
    const statusFilter: Prisma.DailySalesSummaryWhereInput = includeCancelled
      ? { status: { in: ['active', 'cancelled'] } }
      : { status: 'active' };
    const needle = (q || '').trim();
    const shiftFilter = shift === 'morning' || shift === 'evening' || shift === 'all' ? { shift } : {};

    return {
      companyId,
      ...statusFilter,
      ...this.buildDateFilter(startDate, endDate),
      ...(needle
        ? {
            OR: [
              { summaryNumber: { contains: needle, mode: 'insensitive' as const } },
              { notes: { contains: needle, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...shiftFilter,
    };
  }

  private buildDateFilter(startDate?: string, endDate?: string): Prisma.DailySalesSummaryWhereInput {
    if (!startDate && !endDate) return {};
    return {
      transactionDate: {
        ...(startDate ? { gte: new Date(`${toYmd(startDate)}T00:00:00.000Z`) } : {}),
        ...(endDate ? { lte: new Date(`${toYmd(endDate)}T23:59:59.999Z`) } : {}),
      },
    };
  }

  private buildFindAllOrderBy(
    sortBy: string,
    sortDir: 'asc' | 'desc' | string,
  ): Prisma.DailySalesSummaryOrderByWithRelationInput[] {
    const dir: Prisma.SortOrder = String(sortDir).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const allowed = new Set(['transactionDate', 'summaryNumber', 'totalAmount', 'customerCount', 'createdAt']);
    const field = allowed.has(sortBy) ? sortBy : 'transactionDate';
    const orderBy: Prisma.DailySalesSummaryOrderByWithRelationInput[] = [{ [field]: dir }];
    if (field !== 'transactionDate') orderBy.push({ transactionDate: 'desc' });
    return orderBy;
  }
}
