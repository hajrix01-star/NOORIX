import type { PurchasesBatchSummaryRow } from '../types';

export function mapApiBatchSummaryToTableRow(b: any): PurchasesBatchSummaryRow {
  return {
    batchId: b.batchId,
    invoices: [],
    transactionDate: b.transactionDate,
    invoiceCount: b.invoiceCount,
    supplierNames: b.supplierNames || '—',
    vaultName: b.vaultName || '—',
    netAmount: Number(b.netAmount) || 0,
    taxAmount: Number(b.taxAmount) || 0,
    totalAmount: Number(b.totalAmount) || 0,
    status: b.status,
  };
}
