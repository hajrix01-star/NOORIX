import type { PurchaseDebtRecord } from '../../../services/api';

export type PurchaseDebtSupplierGroup = {
  supplierId: string;
  supplierName: string;
  records: PurchaseDebtRecord[];
  totalAmount: number;
  pendingCount: number;
  promotedCount: number;
  cancelledCount: number;
};

function displaySupplierName(record: PurchaseDebtRecord, lang: string): string {
  return lang === 'en'
    ? (record.supplier.nameEn || record.supplier.nameAr)
    : (record.supplier.nameAr || record.supplier.nameEn || '—');
}

/**
 * Keeps the debt register readable without changing the API or its accounting
 * records: each supplier owns one ordered visual section and its own total.
 */
export function groupPurchaseDebtsBySupplier(
  records: readonly PurchaseDebtRecord[],
  lang: string,
): PurchaseDebtSupplierGroup[] {
  const groups = new Map<string, PurchaseDebtSupplierGroup & { amountInHalalas: number }>();

  for (const record of records) {
    const current = groups.get(record.supplierId) ?? {
      supplierId: record.supplierId,
      supplierName: displaySupplierName(record, lang),
      records: [],
      totalAmount: 0,
      amountInHalalas: 0,
      pendingCount: 0,
      promotedCount: 0,
      cancelledCount: 0,
    };
    current.records.push(record);
    current.amountInHalalas += Math.round(Number(record.totalAmount || 0) * 10_000);
    if (record.status === 'pending') current.pendingCount += 1;
    else if (record.status === 'promoted') current.promotedCount += 1;
    else current.cancelledCount += 1;
    groups.set(record.supplierId, current);
  }

  return [...groups.values()]
    .map(({ amountInHalalas, ...group }) => ({ ...group, totalAmount: amountInHalalas / 10_000 }))
    .sort((a, b) => b.totalAmount - a.totalAmount || a.supplierName.localeCompare(b.supplierName, lang));
}
