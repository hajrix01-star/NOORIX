import { PURCHASE_BATCH_EMPTY_VALUE } from '../purchaseBatchDisplayModel';
import { toPurchaseBatchFiniteNumber } from '../purchaseBatchNumberModel';
import type { PurchaseBatchInvoice, PurchaseBatchStatus, PurchaseBatchSummaryRow } from '../purchaseBatchTypes';

export type PurchaseBatchSummaryApiRow = {
  batchId: string;
  invoices?: PurchaseBatchInvoice[] | null;
  transactionDate: string;
  invoiceCount: number;
  supplierNames?: string | null;
  vaultName?: string | null;
  netAmount?: number | string | null;
  taxAmount?: number | string | null;
  totalAmount?: number | string | null;
  status: PurchaseBatchStatus;
};

export function mapApiBatchSummaryToTableRow(row: PurchaseBatchSummaryApiRow): PurchaseBatchSummaryRow {
  return {
    batchId: row.batchId,
    invoices: row.invoices ?? [],
    transactionDate: row.transactionDate,
    invoiceCount: row.invoiceCount,
    supplierNames: row.supplierNames || PURCHASE_BATCH_EMPTY_VALUE,
    vaultName: row.vaultName || PURCHASE_BATCH_EMPTY_VALUE,
    netAmount: toPurchaseBatchFiniteNumber(row.netAmount),
    taxAmount: toPurchaseBatchFiniteNumber(row.taxAmount),
    totalAmount: toPurchaseBatchFiniteNumber(row.totalAmount),
    status: row.status,
  };
}
