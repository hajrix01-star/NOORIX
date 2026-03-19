/**
 * FiscalPeriodService — إدارة الفترات المالية وقفل التسجيل
 *
 * القاعدة: لا يُسمح بالتسجيل في فترة مغلقة (closed) أو مقفلة (locked).
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { Prisma } from '@prisma/client';

type TxClient = Parameters<Parameters<TenantPrismaService['$transaction']>[0]>[0];

@Injectable()
export class FiscalPeriodService {
  constructor(private readonly prisma: TenantPrismaService) {}

  /**
   * التحقق من إمكانية التسجيل في تاريخ معين.
   * يرفض إذا كانت الفترة مغلقة أو مقفلة.
   */
  async assertPeriodOpenForDate(
    tx: TxClient,
    companyId: string,
    transactionDate: Date,
  ): Promise<void> {
    const period = await tx.fiscalPeriod.findFirst({
      where: {
        companyId,
        startDate: { lte: transactionDate },
        endDate: { gte: transactionDate },
      },
      select: { status: true, nameAr: true },
      orderBy: { startDate: 'desc' },
    });

    if (!period) {
      // لا توجد فترة — يُسمح (للشركات القديمة بدون فترات)
      return;
    }

    if (period.status === 'closed') {
      throw new BadRequestException(
        `لا يمكن التسجيل في فترة مغلقة: ${period.nameAr}. يرجى فتح الفترة من إعدادات الفترات المالية.`,
      );
    }

    if (period.status === 'locked') {
      throw new BadRequestException(
        `الفترة ${period.nameAr} مقفلة ولا يمكن التعديل فيها.`,
      );
    }
  }

  /**
   * التحقق من عدم تداخل الفترة المالية مع فترات موجودة.
   * يرفض أيضاً إذا كان endDate <= startDate.
   */
  async assertNoOverlap(
    tx: TxClient,
    companyId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ): Promise<void> {
    if (endDate <= startDate) {
      throw new BadRequestException('تاريخ نهاية الفترة يجب أن يكون بعد تاريخ البداية');
    }
    const where: { companyId: string; startDate: { lte: Date }; endDate: { gte: Date }; id?: { not: string } } = {
      companyId,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    };
    if (excludeId) where.id = { not: excludeId };

    const overlap = await tx.fiscalPeriod.findFirst({
      where,
      select: { nameAr: true, startDate: true, endDate: true },
    });
    if (overlap) {
      throw new BadRequestException(
        `الفترة المالية تتقاطع مع فترة موجودة: ${overlap.nameAr} (${overlap.startDate.toISOString().slice(0, 10)} — ${overlap.endDate.toISOString().slice(0, 10)})`,
      );
    }
  }

  /**
   * إنشاء فترة مالية افتراضية للشركة الجديدة (السنة الحالية).
   */
  async createDefaultPeriodForCompany(
    tx: TxClient,
    tenantId: string,
    companyId: string,
  ): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    await this.assertNoOverlap(tx, companyId, startDate, endDate);

    await tx.fiscalPeriod.create({
      data: {
        tenantId,
        companyId,
        nameAr: `السنة المالية ${year}`,
        nameEn: `Fiscal Year ${year}`,
        startDate,
        endDate,
        status: 'open',
      },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.fiscalPeriod.findMany({
      where: { companyId },
      orderBy: { startDate: 'desc' },
    });
  }

  async closePeriod(id: string, companyId: string, userId: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id, companyId },
    });
    if (!period) throw new BadRequestException('الفترة غير موجودة');
    if (period.status !== 'open') throw new BadRequestException('الفترة مغلقة أو مقفلة مسبقاً');

    return this.prisma.fiscalPeriod.update({
      where: { id },
      data: { status: 'closed', closedAt: new Date(), closedById: userId },
    });
  }

  async createPeriod(
    tenantId: string,
    companyId: string,
    dto: { nameAr: string; nameEn?: string; startDate: Date; endDate: Date },
  ) {
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.assertNoOverlap(tx, companyId, dto.startDate, dto.endDate);
      return tx.fiscalPeriod.create({
        data: {
          tenantId,
          companyId,
          nameAr: dto.nameAr,
          nameEn: dto.nameEn ?? null,
          startDate: dto.startDate,
          endDate: dto.endDate,
          status: 'open',
        },
      });
    });
  }

  async reopenPeriod(id: string, companyId: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id, companyId },
    });
    if (!period) throw new BadRequestException('الفترة غير موجودة');
    if (period.status === 'locked') throw new BadRequestException('لا يمكن فتح فترة مقفلة');

    return this.prisma.fiscalPeriod.update({
      where: { id },
      data: { status: 'open', closedAt: null, closedById: null },
    });
  }
}
