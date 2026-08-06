import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  assertNoActiveDuplicateSupplierInvoiceDedupKey,
  normalizeSupplierInvoiceDedupKey,
} from '../invoice/invoice-supplier-invoice-dedup.util';
import { CreatePurchaseDebtDto } from './dto/create-purchase-debt.dto';
import { PurchaseDebtQueryDto } from './dto/purchase-debt-query.dto';
import { UpdatePurchaseDebtDto } from './dto/update-purchase-debt.dto';
import { toYmd } from '../common/utils/to-ymd.util';

const itemInclude = {
  supplier: { select: { id: true, nameAr: true, nameEn: true, isTaxRegistered: true } },
  createdByUser: { select: { id: true, nameAr: true, nameEn: true, email: true } },
  promotedByUser: { select: { id: true, nameAr: true, nameEn: true, email: true } },
  promotedInvoice: { select: { id: true, invoiceNumber: true, status: true } },
} satisfies Prisma.PurchaseDebtRecordInclude;

type DebtStatus = 'pending' | 'promoted' | 'cancelled';

function endOfDayUtc(value: string): Date {
  const d = new Date(value);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function snapshot(record: {
  supplierId: string;
  supplierInvoiceNumber: string;
  invoiceDate: Date;
  totalAmount: Prisma.Decimal;
  isTaxable: boolean;
  notes: string | null;
  status: string;
}) {
  return {
    supplierId: record.supplierId,
    supplierInvoiceNumber: record.supplierInvoiceNumber,
    invoiceDate: record.invoiceDate.toISOString(),
    totalAmount: record.totalAmount.toFixed(4),
    isTaxable: record.isTaxable,
    notes: record.notes,
    status: record.status,
  };
}

export function isFuturePurchaseDebtDate(value: string | Date, now = new Date()): boolean {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value || '';
  const riyadhToday = `${part('year')}-${part('month')}-${part('day')}`;
  return toYmd(date) > riyadhToday;
}

function assertHistoricalInvoiceDate(value: string | Date): void {
  if (isFuturePurchaseDebtDate(value)) {
    throw new BadRequestException('تاريخ الفاتورة يجب ألا يكون في المستقبل.');
  }
}

@Injectable()
export class PurchaseDebtsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  private baseWhere(companyId: string, query: PurchaseDebtQueryDto): Prisma.PurchaseDebtRecordWhereInput {
    const q = query.q?.trim().slice(0, 120);
    return {
      companyId,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.invoiceFrom || query.invoiceTo ? {
        invoiceDate: {
          ...(query.invoiceFrom ? { gte: new Date(query.invoiceFrom) } : {}),
          ...(query.invoiceTo ? { lte: endOfDayUtc(query.invoiceTo) } : {}),
        },
      } : {}),
      ...(query.promotedFrom || query.promotedTo ? {
        promotedAt: {
          ...(query.promotedFrom ? { gte: new Date(query.promotedFrom) } : {}),
          ...(query.promotedTo ? { lte: endOfDayUtc(query.promotedTo) } : {}),
        },
      } : {}),
      ...(query.createdFrom || query.createdTo ? {
        createdAt: {
          ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
          ...(query.createdTo ? { lte: endOfDayUtc(query.createdTo) } : {}),
        },
      } : {}),
      ...(query.amountMin != null || query.amountMax != null ? {
        totalAmount: {
          ...(query.amountMin != null ? { gte: query.amountMin } : {}),
          ...(query.amountMax != null ? { lte: query.amountMax } : {}),
        },
      } : {}),
      ...(q ? {
        OR: [
          { supplierInvoiceNumber: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
          { supplier: { nameAr: { contains: q, mode: 'insensitive' } } },
          { supplier: { nameEn: { contains: q, mode: 'insensitive' } } },
        ],
      } : {}),
    };
  }

  async list(companyId: string, query: PurchaseDebtQueryDto) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 25));
    const baseWhere = this.baseWhere(companyId, query);
    const status = query.status as DebtStatus | undefined;
    const where = { ...baseWhere, ...(status ? { status } : { status: { in: ['pending', 'promoted', 'cancelled'] } }) };
    const [items, total, pendingAgg, promotedAgg, cancelledCount] = await Promise.all([
      this.loadPage(baseWhere, status, page, pageSize),
      this.prisma.purchaseDebtRecord.count({ where }),
      this.prisma.purchaseDebtRecord.aggregate({
        where: { ...baseWhere, status: 'pending' },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.purchaseDebtRecord.aggregate({
        where: { ...baseWhere, status: 'promoted' },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.purchaseDebtRecord.count({ where: { ...baseWhere, status: 'cancelled' } }),
    ]);
    const pendingCount = pendingAgg._count._all;
    const promotedCount = promotedAgg._count._all;
    const activeCount = pendingCount + promotedCount;
    return {
      items,
      total,
      page,
      pageSize,
      summary: {
        totalCount: activeCount,
        totalAmount: Number(pendingAgg._sum.totalAmount || 0) + Number(promotedAgg._sum.totalAmount || 0),
        pendingCount,
        pendingAmount: Number(pendingAgg._sum.totalAmount || 0),
        promotedCount,
        promotedAmount: Number(promotedAgg._sum.totalAmount || 0),
        cancelledCount,
        promotionRate: Number(pendingAgg._sum.totalAmount || 0) + Number(promotedAgg._sum.totalAmount || 0) > 0
          ? Math.round(
              (Number(promotedAgg._sum.totalAmount || 0) /
                (Number(pendingAgg._sum.totalAmount || 0) + Number(promotedAgg._sum.totalAmount || 0))) * 1000,
            ) / 10
          : 0,
      },
    };
  }

  private async loadPage(
    baseWhere: Prisma.PurchaseDebtRecordWhereInput,
    status: DebtStatus | undefined,
    page: number,
    pageSize: number,
  ) {
    if (!status) return this.loadGroupedPage(baseWhere, page, pageSize);
    const orderBy: Prisma.PurchaseDebtRecordOrderByWithRelationInput[] =
      status === 'promoted' ? [{ promotedAt: 'desc' }, { invoiceDate: 'desc' }]
      : status === 'cancelled' ? [{ updatedAt: 'desc' }]
      : [{ invoiceDate: 'asc' }, { createdAt: 'asc' }];
    return this.prisma.purchaseDebtRecord.findMany({
      where: { ...baseWhere, status },
      include: itemInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  private async loadGroupedPage(
    baseWhere: Prisma.PurchaseDebtRecordWhereInput,
    page: number,
    pageSize: number,
  ) {
    const groups: Array<{
      status: DebtStatus;
      orderBy: Prisma.PurchaseDebtRecordOrderByWithRelationInput[];
    }> = [
      { status: 'pending', orderBy: [{ invoiceDate: 'asc' }, { createdAt: 'asc' }] },
      { status: 'promoted', orderBy: [{ promotedAt: 'desc' }, { invoiceDate: 'desc' }] },
      { status: 'cancelled', orderBy: [{ updatedAt: 'desc' }] },
    ];
    let skip = (page - 1) * pageSize;
    let remaining = pageSize;
    const items: Awaited<ReturnType<typeof this.prisma.purchaseDebtRecord.findMany>> = [];
    for (const group of groups) {
      if (remaining === 0) break;
      const groupWhere = { ...baseWhere, status: group.status };
      const count = await this.prisma.purchaseDebtRecord.count({ where: groupWhere });
      if (skip >= count) {
        skip -= count;
        continue;
      }
      const loaded = await this.prisma.purchaseDebtRecord.findMany({
        where: groupWhere, include: itemInclude, orderBy: group.orderBy,
        skip, take: remaining,
      });
      items.push(...loaded);
      remaining -= loaded.length;
      skip = 0;
    }
    return items;
  }

  async create(companyId: string, dto: CreatePurchaseDebtDto, userId: string) {
    const invoiceNumber = dto.supplierInvoiceNumber.trim();
    const normalizedInvoiceKey = normalizeSupplierInvoiceDedupKey(invoiceNumber);
    if (!normalizedInvoiceKey) throw new BadRequestException('رقم فاتورة المورد مطلوب.');
    assertHistoricalInvoiceDate(dto.invoiceDate);
    const tenantId = TenantContext.getTenantId();
    try {
      return await this.prisma.withTenant(async (tx) => {
        await this.assertSupplier(tx, companyId, dto.supplierId);
        await assertNoActiveDuplicateSupplierInvoiceDedupKey(tx, {
          companyId, supplierId: dto.supplierId, dedupKey: normalizedInvoiceKey,
        });
        const record = await tx.purchaseDebtRecord.create({
          data: {
            tenantId, companyId, supplierId: dto.supplierId,
            supplierInvoiceNumber: invoiceNumber, normalizedInvoiceKey,
            invoiceDate: new Date(dto.invoiceDate), totalAmount: dto.totalAmount,
            isTaxable: dto.isTaxable !== false, notes: dto.notes?.trim() || null,
            createdByUserId: userId,
          },
          include: itemInclude,
        });
        await tx.auditLog.create({ data: {
          tenantId, companyId, userId, action: 'create', entity: 'purchase_debt_record',
          entityId: record.id, newValue: snapshot(record),
        } });
        return record;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('هذه الفاتورة مسجلة مسبقًا لنفس المورد.');
      }
      throw error;
    }
  }

  async update(id: string, companyId: string, dto: UpdatePurchaseDebtDto, userId: string) {
    try {
      return await this.prisma.withTenant(async (tx) => {
        const current = await tx.purchaseDebtRecord.findFirst({ where: { id, companyId } });
        if (!current) throw new NotFoundException('سجل المديونية غير موجود.');
        if (current.status !== 'pending') throw new BadRequestException('لا يمكن تعديل سجل تم ترحيله أو إلغاؤه.');
        const supplierId = dto.supplierId ?? current.supplierId;
        const invoiceNumber = dto.supplierInvoiceNumber?.trim() ?? current.supplierInvoiceNumber;
        const normalizedInvoiceKey = normalizeSupplierInvoiceDedupKey(invoiceNumber);
        if (!normalizedInvoiceKey) throw new BadRequestException('رقم فاتورة المورد مطلوب.');
        if (dto.invoiceDate) assertHistoricalInvoiceDate(dto.invoiceDate);
        await this.assertSupplier(tx, companyId, supplierId);
        await assertNoActiveDuplicateSupplierInvoiceDedupKey(tx, {
          companyId, supplierId, dedupKey: normalizedInvoiceKey,
        });
        const changed = await tx.purchaseDebtRecord.updateMany({
          where: { id, companyId, status: 'pending' },
          data: {
            supplierId, supplierInvoiceNumber: invoiceNumber, normalizedInvoiceKey,
            ...(dto.invoiceDate ? { invoiceDate: new Date(dto.invoiceDate) } : {}),
            ...(dto.totalAmount != null ? { totalAmount: dto.totalAmount } : {}),
            ...(dto.isTaxable != null ? { isTaxable: dto.isTaxable } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
          },
        });
        if (changed.count !== 1) throw new ConflictException('تغيرت حالة السجل أثناء التعديل. حدّث القائمة ثم حاول مجددًا.');
        const updated = await tx.purchaseDebtRecord.findFirstOrThrow({ where: { id, companyId }, include: itemInclude });
        await tx.auditLog.create({ data: {
          tenantId: current.tenantId, companyId, userId, action: 'update', entity: 'purchase_debt_record',
          entityId: id, oldValue: snapshot(current), newValue: snapshot(updated),
        } });
        return updated;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('هذه الفاتورة مسجلة مسبقًا لنفس المورد.');
      }
      throw error;
    }
  }

  async cancel(id: string, companyId: string, userId: string) {
    return this.prisma.withTenant(async (tx) => {
      const current = await tx.purchaseDebtRecord.findFirst({ where: { id, companyId } });
      if (!current) throw new NotFoundException('سجل المديونية غير موجود.');
      if (current.status !== 'pending') throw new BadRequestException('يمكن إلغاء السجلات غير المرحلة فقط.');
      const changed = await tx.purchaseDebtRecord.updateMany({
        where: { id, companyId, status: 'pending' }, data: { status: 'cancelled' },
      });
      if (changed.count !== 1) throw new ConflictException('تغيرت حالة السجل أثناء الإلغاء. حدّث القائمة ثم حاول مجددًا.');
      const updated = await tx.purchaseDebtRecord.findFirstOrThrow({ where: { id, companyId }, include: itemInclude });
      await tx.auditLog.create({ data: {
        tenantId: current.tenantId, companyId, userId, action: 'cancel', entity: 'purchase_debt_record',
        entityId: id, oldValue: snapshot(current), newValue: snapshot(updated),
      } });
      return updated;
    });
  }

  async restore(id: string, companyId: string, userId: string) {
    return this.prisma.withTenant(async (tx) => {
      const current = await tx.purchaseDebtRecord.findFirst({ where: { id, companyId } });
      if (!current) throw new NotFoundException('سجل المديونية غير موجود.');
      if (current.status !== 'cancelled') throw new BadRequestException('يمكن استعادة السجلات الملغاة فقط.');
      const changed = await tx.purchaseDebtRecord.updateMany({
        where: { id, companyId, status: 'cancelled' }, data: { status: 'pending' },
      });
      if (changed.count !== 1) throw new ConflictException('تغيرت حالة السجل أثناء الاستعادة. حدّث القائمة ثم حاول مجددًا.');
      const restored = await tx.purchaseDebtRecord.findFirstOrThrow({ where: { id, companyId }, include: itemInclude });
      await tx.auditLog.create({ data: {
        tenantId: current.tenantId, companyId, userId, action: 'update', entity: 'purchase_debt_record',
        entityId: id, oldValue: snapshot(current), newValue: snapshot(restored),
      } });
      return restored;
    });
  }

  private async assertSupplier(
    tx: Pick<Prisma.TransactionClient, 'supplier'>,
    companyId: string,
    supplierId: string,
  ) {
    const supplier = await tx.supplier.findFirst({
      where: { id: supplierId, companyId, isDeleted: false }, select: { id: true },
    });
    if (!supplier) throw new BadRequestException('المورد غير موجود في هذه الشركة.');
  }
}
