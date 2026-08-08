import type { PurchaseDebtRecord } from '../../../services/api';

export type PurchaseDebtSupplierGroup = {
  supplierId: string;
  supplierName: string;
  records: PurchaseDebtRecord[];
  /** Current amount due. Promoted and cancelled rows remain visible as history only. */
  totalAmount: number;
  pendingCount: number;
  promotedCount: number;
  cancelledCount: number;
};

export type PurchaseDebtSort =
  | 'supplier_total_desc'
  | 'supplier_total_asc'
  | 'invoice_amount_desc'
  | 'invoice_amount_asc'
  | 'invoice_date_desc'
  | 'invoice_date_asc';

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
  sort: PurchaseDebtSort = 'supplier_total_desc',
): PurchaseDebtSupplierGroup[] {
  const groups = new Map<string, PurchaseDebtSupplierGroup & { outstandingInHalalas: number }>();

  for (const record of records) {
    const current = groups.get(record.supplierId) ?? {
      supplierId: record.supplierId,
      supplierName: displaySupplierName(record, lang),
      records: [],
      totalAmount: 0,
      outstandingInHalalas: 0,
      pendingCount: 0,
      promotedCount: 0,
      cancelledCount: 0,
    };
    current.records.push(record);
    if (record.status === 'pending') {
      current.pendingCount += 1;
      current.outstandingInHalalas += Math.round(Number(record.totalAmount || 0) * 10_000);
    }
    else if (record.status === 'promoted') current.promotedCount += 1;
    else current.cancelledCount += 1;
    groups.set(record.supplierId, current);
  }

  const sortInvoices = (a: PurchaseDebtRecord, b: PurchaseDebtRecord) => {
    if (sort === 'invoice_amount_desc') return Number(b.totalAmount) - Number(a.totalAmount);
    if (sort === 'invoice_amount_asc') return Number(a.totalAmount) - Number(b.totalAmount);
    if (sort === 'invoice_date_desc') return String(b.invoiceDate).localeCompare(String(a.invoiceDate));
    return String(a.invoiceDate).localeCompare(String(b.invoiceDate));
  };

  const normalized = [...groups.values()].map(({ outstandingInHalalas, ...group }) => ({
    ...group,
    totalAmount: outstandingInHalalas / 10_000,
    records: [...group.records].sort(sortInvoices),
  }));

  return normalized.sort((a, b) => {
    if (sort === 'supplier_total_desc') return b.totalAmount - a.totalAmount || a.supplierName.localeCompare(b.supplierName, lang);
    if (sort === 'supplier_total_asc') return a.totalAmount - b.totalAmount || a.supplierName.localeCompare(b.supplierName, lang);
    const firstA = a.records[0];
    const firstB = b.records[0];
    return sortInvoices(firstA, firstB) || a.supplierName.localeCompare(b.supplierName, lang);
  });
}
