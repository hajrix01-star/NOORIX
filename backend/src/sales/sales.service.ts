/**
 * SalesService — طبقة رفيعة (Thin Layer) فوق FinancialCoreService
 *
 * createSummary يُفوَّض بالكامل → FinancialCoreService.processInflow
 * findAll تبقى هنا (قراءة بحتة).
 */
import { Injectable }           from '@nestjs/common';
import { Prisma }                from '@prisma/client';
import { TenantPrismaService }   from '../prisma/tenant-prisma.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { toYmd } from '../common/utils/to-ymd.util';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma:        TenantPrismaService,
    private readonly financialCore: FinancialCoreService,
  ) {}

  /**
   * إنشاء ملخص مبيعات يومي — يُفوَّض للمحرك المالي المركزي.
   * الـ transaction الكاملة (ملخص + قنوات + قيود + تدقيق) داخل FinancialCoreService.
   */
  async createSummary(dto: {
    companyId:       string;
    transactionDate: string;
    customerCount:   number;
    cashOnHand:      string;
    channels:        { vaultId: string; amount: string }[];
    notes?:          string;
    idempotencyKey?: string;
    userId?:         string;
  }) {
    return this.financialCore.processInflow(
      {
        companyId:       dto.companyId,
        transactionDate: dto.transactionDate,
        customerCount:   dto.customerCount,
        cashOnHand:      dto.cashOnHand,
        channels:        dto.channels,
        notes:           dto.notes,
        idempotencyKey:  dto.idempotencyKey,
      },
      dto.userId,
    );
  }

  /** تضمين موحّد لقنوات الملخص — يُستخدم في القائمة وحزمة الداشبورد. */
  private dailySalesSummaryListInclude(): Prisma.DailySalesSummaryInclude {
    return {
      channels: {
        orderBy: [
          { vault: { sortOrder: 'asc' } },
          { vault: { nameAr: 'asc' } },
        ],
        include: {
          vault: { select: { nameAr: true, type: true, paymentMethod: true, sortOrder: true } },
        },
      },
      createdBy: { select: { nameAr: true } },
    };
  }

  /**
   * حزمة واحدة للوحة التحكم: سنة كاملة + نطاق يومي + نطاق شهري — استعلامات متوازية بدل حلقات HTTP.
   */
  async findDashboardPack(
    companyId: string,
    ranges: {
      yearStart: string;
      yearEnd: string;
      dailyStart?: string | null;
      dailyEnd?: string | null;
      monthStart?: string | null;
      monthEnd?: string | null;
    },
    includeCancelled = false,
  ) {
    const statusFilter: Prisma.DailySalesSummaryWhereInput = includeCancelled
      ? { status: { in: ['active', 'cancelled'] } }
      : { status: 'active' };
    const inc = this.dailySalesSummaryListInclude();
    const orderBy: Prisma.DailySalesSummaryOrderByWithRelationInput[] = [
      { transactionDate: 'asc' },
      { summaryNumber: 'asc' },
    ];

    const y0 = toYmd(ranges.yearStart);
    const y1 = toYmd(ranges.yearEnd);
    const yearWhere: Prisma.DailySalesSummaryWhereInput = {
      companyId,
      ...statusFilter,
      transactionDate: {
        gte: new Date(`${y0}T00:00:00.000Z`),
        lte: new Date(`${y1}T23:59:59.999Z`),
      },
    };

    const dailyWhere: Prisma.DailySalesSummaryWhereInput | null =
      ranges.dailyStart && ranges.dailyEnd
        ? {
            companyId,
            ...statusFilter,
            transactionDate: {
              gte: new Date(`${toYmd(ranges.dailyStart)}T00:00:00.000Z`),
              lte: new Date(`${toYmd(ranges.dailyEnd)}T23:59:59.999Z`),
            },
          }
        : null;

    const monthWhere: Prisma.DailySalesSummaryWhereInput | null =
      ranges.monthStart && ranges.monthEnd
        ? {
            companyId,
            ...statusFilter,
            transactionDate: {
              gte: new Date(`${toYmd(ranges.monthStart)}T00:00:00.000Z`),
              lte: new Date(`${toYmd(ranges.monthEnd)}T23:59:59.999Z`),
            },
          }
        : null;

    const [yearSummaries, dailySummaries, monthSummaries] = await Promise.all([
      this.prisma.dailySalesSummary.findMany({
        where: yearWhere,
        orderBy,
        take: 4000,
        include: inc,
      }),
      dailyWhere
        ? this.prisma.dailySalesSummary.findMany({
            where: dailyWhere,
            orderBy,
            take: 500,
            include: inc,
          })
        : Promise.resolve([]),
      monthWhere
        ? this.prisma.dailySalesSummary.findMany({
            where: monthWhere,
            orderBy,
            take: 500,
            include: inc,
          })
        : Promise.resolve([]),
    ]);

    return { yearSummaries, dailySummaries, monthSummaries };
  }

  /**
   * جلب ملخصات المبيعات مع فلترة التاريخ والتصفح.
   */
  async findAll(
    companyId: string,
    startDate?: string,
    endDate?:   string,
    page       = 1,
    pageSize   = 30,
    q?:         string,
    sortBy = 'transactionDate',
    sortDir: 'asc' | 'desc' | string = 'desc',
    includeCancelled = false,
  ) {
    const dateFilter =
      startDate || endDate
        ? {
            transactionDate: {
              ...(startDate
                ? { gte: new Date(`${toYmd(startDate)}T00:00:00.000Z`) }
                : {}),
              ...(endDate
                ? { lte: new Date(`${toYmd(endDate)}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {};

    const statusFilter: Prisma.DailySalesSummaryWhereInput = includeCancelled
      ? { status: { in: ['active', 'cancelled'] } }
      : { status: 'active' };

    const needle = (q || '').trim();
    const searchFilter =
      needle.length > 0
        ? {
            OR: [
              { summaryNumber: { contains: needle, mode: 'insensitive' as const } },
              { notes: { contains: needle, mode: 'insensitive' as const } },
            ],
          }
        : {};

    const where = { companyId, ...statusFilter, ...dateFilter, ...searchFilter };

    const dir: Prisma.SortOrder = String(sortDir).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const allowed = new Set(['transactionDate', 'summaryNumber', 'totalAmount', 'customerCount', 'createdAt']);
    const field = allowed.has(sortBy) ? sortBy : 'transactionDate';
    const orderBy: Prisma.DailySalesSummaryOrderByWithRelationInput[] = [
      { [field]: dir },
    ];
    if (field !== 'transactionDate') {
      orderBy.push({ transactionDate: 'desc' });
    }

    const size = Math.min(200, Math.max(1, pageSize));
    const p = Math.max(1, page);

    const [items, total] = await Promise.all([
      this.prisma.dailySalesSummary.findMany({
        where,
        orderBy,
        skip:    (p - 1) * size,
        take:    size,
        include: this.dailySalesSummaryListInclude(),
      }),
      this.prisma.dailySalesSummary.count({ where }),
    ]);

    return { items, total, page: p, pageSize: size };
  }

  /**
   * تحديث ملخص مبيعات — يلغي القيود القديمة وينشئ قيوداً جديدة.
   */
  async updateSummary(
    id: string,
    companyId: string,
    dto: {
      transactionDate?: string;
      customerCount?: number;
      cashOnHand?: string;
      channels?: { vaultId: string; amount: string }[];
      notes?: string;
    },
    userId?: string,
  ) {
    const summary = await this.prisma.dailySalesSummary.findFirst({
      where: { id, companyId, status: 'active' },
      include: { channels: true },
    });
    if (!summary) {
      throw new Error('الملخص غير موجود أو تم إلغاؤه.');
    }
    if (!dto.channels?.length) {
      throw new Error('يجب إدخال قناة بيع واحدة على الأقل.');
    }
    const totalAmount = dto.channels.reduce(
      (sum, ch) => sum.plus(new Prisma.Decimal(ch.amount || '0')),
      new Prisma.Decimal(0),
    );
    if (totalAmount.lte(0)) {
      throw new Error('يجب أن يكون إجمالي المبيعات أكبر من صفر.');
    }

    return this.financialCore.updateInflow(id, companyId, {
      transactionDate: dto.transactionDate ?? toYmd(summary.transactionDate),
      customerCount:   dto.customerCount ?? summary.customerCount,
      cashOnHand:      dto.cashOnHand ?? String(summary.cashOnHand),
      channels:        dto.channels,
      notes:           dto.notes ?? summary.notes ?? undefined,
    }, userId);
  }

  /** إلغاء ملخص مبيعات (لا حذف — Status: cancelled) */
  async cancelSummary(id: string, companyId: string, userId?: string) {
    return this.financialCore.cancelOperation(
      { referenceType: 'sale', referenceId: id, companyId, reason: 'إلغاء من واجهة المبيعات' },
      userId,
    );
  }
}
