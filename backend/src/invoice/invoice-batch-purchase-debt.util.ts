import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toYmd } from '../common/utils/to-ymd.util';
import type { TxClient } from '../financial-core/financial-core-helpers.util';
import type { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';
import type { TenantPrismaService } from '../prisma/tenant-prisma.service';

type PreparedDebt = { id: string; itemIndex: number };

export class PurchaseDebtReservationConflict extends BadRequestException {}

export async function reserveAndHydratePurchaseDebtItems(
  tx: TxClient,
  companyId: string,
  items: CreateInvoiceBatchDto['items'],
): Promise<{ items: CreateInvoiceBatchDto['items']; debts: PreparedDebt[] }> {
  const seen = new Set<string>();
  const hydrated = [...items];
  const debts: PreparedDebt[] = [];

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const legacyDebtId = items[itemIndex]?.legacyDebtId?.trim();
    if (!legacyDebtId) continue;
    if (seen.has(legacyDebtId)) {
      throw new BadRequestException('لا يمكن إضافة سجل المديونية نفسه أكثر من مرة في الدفعة.');
    }
    seen.add(legacyDebtId);

    const reserved = await tx.purchaseDebtRecord.updateMany({
      where: { id: legacyDebtId, companyId, status: 'pending' },
      data: { status: 'promoting' },
    });
    if (reserved.count !== 1) {
      const exists = await tx.purchaseDebtRecord.findFirst({
        where: { id: legacyDebtId, companyId }, select: { status: true },
      });
      if (!exists) throw new NotFoundException('سجل المديونية غير موجود في هذه الشركة.');
      throw new PurchaseDebtReservationConflict('تم ترحيل سجل المديونية مسبقًا أو لم يعد متاحًا للترحيل.');
    }

    const debt = await tx.purchaseDebtRecord.findFirstOrThrow({
      where: { id: legacyDebtId, companyId, status: 'promoting' },
      include: {
        supplier: {
          select: {
            supplierCategoryId: true,
            supplierCategory: { select: { accountId: true } },
          },
        },
      },
    });
    hydrated[itemIndex] = {
      ...items[itemIndex]!,
      legacyDebtId,
      supplierId: debt.supplierId,
      supplierInvoiceNumber: debt.supplierInvoiceNumber,
      invoiceNumber: undefined,
      kind: 'purchase',
      expenseLineId: undefined,
      categoryId: debt.supplier.supplierCategoryId ?? undefined,
      debitAccountId: debt.supplier.supplierCategory?.accountId ?? undefined,
      totalAmount: Number(debt.totalAmount),
      isTaxable: debt.isTaxable,
      invoiceDate: toYmd(debt.invoiceDate),
      notes: debt.notes ?? undefined,
      warrantyFollowUp: false,
    };
    debts.push({ id: debt.id, itemIndex });
  }
  return { items: hydrated, debts };
}

export async function completePurchaseDebtPromotion(
  tx: TxClient,
  companyId: string,
  debts: PreparedDebt[],
  results: Array<{ invoice: { id: string } }>,
  promotionBatchId: string,
  userId: string,
  tenantId: string,
  promotionIdempotencyKey?: string,
): Promise<void> {
  const promotedAt = new Date();
  const promotionInvoiceIds = results.map((result) => result.invoice.id);
  for (const debt of debts) {
    const invoice = results[debt.itemIndex]?.invoice;
    if (!invoice) throw new BadRequestException('تعذر ربط سجل المديونية بفاتورة المشتريات الناتجة.');
    const promoted = await tx.purchaseDebtRecord.updateMany({
      where: { id: debt.id, companyId, status: 'promoting' },
      data: {
        status: 'promoted', promotedAt, promotedByUserId: userId,
        promotedInvoiceId: invoice.id, promotionBatchId,
        promotionIdempotencyKey: promotionIdempotencyKey || null,
        promotionInvoiceIds,
      },
    });
    if (promoted.count !== 1) throw new BadRequestException('تعذر إكمال ترحيل سجل المديونية بأمان.');
    await tx.auditLog.create({
      data: {
        tenantId, companyId, userId, action: 'update', entity: 'purchase_debt_record',
        entityId: debt.id,
        oldValue: { status: 'pending' } as Prisma.InputJsonValue,
        newValue: {
          status: 'promoted', promotedAt: promotedAt.toISOString(),
          promotedInvoiceId: invoice.id, promotionBatchId,
          promotionIdempotencyKey: promotionIdempotencyKey || null,
          promotionInvoiceIds,
        } as Prisma.InputJsonValue,
      },
    });
  }
}

export async function loadPurchaseDebtPromotionReplay(
  prisma: Pick<TenantPrismaService, 'purchaseDebtRecord' | 'invoice'>,
  companyId: string,
  debtIds: string[],
  idempotencyKey: string | undefined,
) {
  if (!idempotencyKey || debtIds.length === 0) return null;
  const uniqueIds = [...new Set(debtIds)];
  if (uniqueIds.length !== debtIds.length) return null;
  const records = await prisma.purchaseDebtRecord.findMany({
    where: { id: { in: uniqueIds }, companyId },
    select: {
      status: true,
      promotionBatchId: true,
      promotionIdempotencyKey: true,
      promotionInvoiceIds: true,
    },
  });
  if (records.length !== uniqueIds.length) return null;
  if (!records.every((record) =>
    record.status === 'promoted'
    && record.promotionIdempotencyKey === idempotencyKey
    && !!record.promotionBatchId,
  )) return null;
  const batchId = records[0]!.promotionBatchId!;
  if (!records.every((record) => record.promotionBatchId === batchId)) return null;
  const invoiceIds = records[0]!.promotionInvoiceIds;
  if (invoiceIds.length === 0) return null;
  if (!records.every((record) =>
    record.promotionInvoiceIds.length === invoiceIds.length
    && record.promotionInvoiceIds.every((id, index) => id === invoiceIds[index]),
  )) return null;
  const invoices = await prisma.invoice.findMany({
    where: { companyId, batchId, id: { in: invoiceIds } },
  });
  if (invoices.length !== invoiceIds.length) return null;
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const orderedInvoices = invoiceIds.flatMap((id) => {
    const invoice = byId.get(id);
    return invoice ? [invoice] : [];
  });
  return orderedInvoices.length === invoiceIds.length
    ? { batchId, invoices: orderedInvoices }
    : null;
}
