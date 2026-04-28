/**
 * Types for Purchases batch screen — mirrors existing runtime shapes (no behavior change).
 */

export type PurchasesBatchTabId = 'entry' | 'history';

/** Row shown in the saved-batches SmartTable */
export interface PurchasesBatchSummaryRow {
  batchId: string;
  invoices: unknown[];
  transactionDate: string;
  invoiceCount: number;
  supplierNames: string;
  vaultName: string;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: string;
}

/** Translation function shape used by batch helpers */
export type BatchTranslateFn = (key: string, ...args: unknown[]) => string;
