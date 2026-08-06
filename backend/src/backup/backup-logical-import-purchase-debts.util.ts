import { Prisma } from '@prisma/client';
import { normalizeSupplierInvoiceDedupKey } from '../invoice/invoice-supplier-invoice-dedup.util';
import {
  importSnapshotArr as arr,
  importSnapshotDec as dec,
  importSnapshotDdate as ddate,
} from './backup-logical-import-helpers.util';
import type { BackupLogicalImportTxParams } from './backup-logical-import-transaction.types';

export async function importBackupLogicalPurchaseDebts(
  tx: Prisma.TransactionClient,
  p: BackupLogicalImportTxParams,
  maps: { supplierMap: Map<string, string>; invoiceMap: Map<string, string> },
): Promise<void> {
  const { tenantId, newCompanyId, data, importingUserId, nid } = p;
  for (const row of arr<Record<string, unknown>>(data.purchaseDebtRecords ?? [])) {
    const supplierId = maps.supplierMap.get(String(row.supplierId));
    if (!supplierId) continue;
    const supplierInvoiceNumber = String(row.supplierInvoiceNumber || '').trim();
    const normalizedInvoiceKey = normalizeSupplierInvoiceDedupKey(supplierInvoiceNumber);
    if (!normalizedInvoiceKey) continue;

    const sourceStatus = String(row.status || 'pending');
    const mappedInvoiceId = row.promotedInvoiceId
      ? maps.invoiceMap.get(String(row.promotedInvoiceId))
      : undefined;
    const sourcePromotionInvoiceIds = arr<unknown>(row.promotionInvoiceIds ?? [])
      .map((value) => String(value));
    const mappedPromotionInvoiceIds = sourcePromotionInvoiceIds
      .flatMap((id) => {
        const mapped = maps.invoiceMap.get(id);
        return mapped ? [mapped] : [];
      });
    const promotionInvoiceIds = mappedPromotionInvoiceIds.length > 0
      ? mappedPromotionInvoiceIds
      : mappedInvoiceId ? [mappedInvoiceId] : [];
    const hasCompleteReplayOrder = sourcePromotionInvoiceIds.length === 0
      || mappedPromotionInvoiceIds.length === sourcePromotionInvoiceIds.length;
    const isPromoted = sourceStatus === 'promoted' && !!mappedInvoiceId && hasCompleteReplayOrder;
    const status = isPromoted ? 'promoted' : sourceStatus === 'cancelled' ? 'cancelled' : 'pending';
    await tx.purchaseDebtRecord.create({
      data: {
        id: nid(), tenantId, companyId: newCompanyId, supplierId,
        supplierInvoiceNumber, normalizedInvoiceKey,
        invoiceDate: ddate(row.invoiceDate), totalAmount: dec(row.totalAmount),
        isTaxable: row.isTaxable !== false,
        notes: (row.notes as string | null) ?? null,
        status,
        createdByUserId: importingUserId,
        promotedByUserId: isPromoted ? importingUserId : null,
        promotedAt: isPromoted && row.promotedAt ? ddate(row.promotedAt) : null,
        promotedInvoiceId: isPromoted ? mappedInvoiceId : null,
        promotionBatchId: isPromoted ? ((row.promotionBatchId as string | null) ?? null) : null,
        promotionIdempotencyKey: isPromoted
          ? ((row.promotionIdempotencyKey as string | null) ?? null)
          : null,
        promotionInvoiceIds: isPromoted ? promotionInvoiceIds : [],
        createdAt: row.createdAt ? ddate(row.createdAt) : new Date(),
        updatedAt: row.updatedAt ? ddate(row.updatedAt) : new Date(),
      },
    });
  }
}
