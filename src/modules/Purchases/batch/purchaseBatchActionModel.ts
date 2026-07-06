import { normalizePurchaseBatchLine } from '@noorix/finance-core';
import { isWarrantyFollowUpKind } from '../utils/batchRowModel';
import type {
  BatchTranslateFn,
  PurchaseBatchEntryRow,
  PurchaseBatchInvoice,
} from './purchaseBatchTypes';
import type { CreateInvoiceBatchResult } from '../../../types/api';

export type PurchaseBatchItemPayload = {
  supplierId?: string;
  expenseLineId?: string;
  invoiceNumber?: string;
  supplierInvoiceNumber?: string;
  kind: string;
  totalAmount: number;
  isTaxable: boolean;
  invoiceDate?: string;
  categoryId?: string;
  debitAccountId?: string;
  notes?: string;
  warrantyFollowUp?: true;
};

export type PurchaseBatchInvoiceUpdatePayload = {
  supplierId?: string | null;
  supplierInvoiceNumber?: string | number | null;
  kind?: string | null;
  totalAmount?: number | string | null;
  isTaxable: boolean;
  status?: string | null;
  transactionDate?: string;
};

export function prefixedPurchaseBatchNotes(kind: string, notes: string | undefined, t: BatchTranslateFn) {
  if (kind === 'fixed_expense') {
    return notes ? `${t('fixedExpenseType')} - ${notes}` : t('fixedExpenseType');
  }
  if (kind === 'expense') {
    return notes ? `${t('expenseType')} - ${notes}` : t('expenseType');
  }
  return notes;
}

export function buildPurchaseBatchItemPayload(row: PurchaseBatchEntryRow, t: BatchTranslateFn): PurchaseBatchItemPayload {
  const normalized = normalizePurchaseBatchLine(row);
  const kind = normalized.kind || 'purchase';
  const notes = prefixedPurchaseBatchNotes(kind, normalized.notes, t);

  return {
    supplierId: normalized.supplierId,
    expenseLineId: normalized.expenseLineId,
    invoiceNumber: normalized.invoiceNumber,
    supplierInvoiceNumber: normalized.supplierInvoiceNumber,
    kind,
    totalAmount: normalized.totalAmount,
    isTaxable: normalized.isTaxable,
    invoiceDate: normalized.invoiceDate,
    categoryId: normalized.categoryId,
    debitAccountId: normalized.debitAccountId,
    notes: notes || undefined,
    ...(isWarrantyFollowUpKind(kind) && row.warrantyFollowUp ? { warrantyFollowUp: true } : {}),
  };
}

export function buildPurchaseBatchInvoiceUpdatePayload(
  invoice: PurchaseBatchInvoice,
): PurchaseBatchInvoiceUpdatePayload {
  const transactionDate =
    typeof invoice.transactionDate === 'string' && invoice.transactionDate.trim()
      ? invoice.transactionDate.trim().slice(0, 10)
      : undefined;

  return {
    supplierId: invoice.supplierId,
    supplierInvoiceNumber: invoice.supplierInvoiceNumber ?? invoice.invoiceNumber,
    kind: invoice.kind,
    totalAmount: invoice.totalAmount,
    isTaxable: invoice.isTaxable !== false,
    status: invoice.status,
    ...(transactionDate ? { transactionDate } : {}),
  };
}

export function requirePurchaseBatchSaveResult(
  result: CreateInvoiceBatchResult | undefined,
  fallbackMessage: string,
): CreateInvoiceBatchResult {
  if (!result?.batchId || !Number.isFinite(result.count) || !Array.isArray(result.invoices)) {
    throw new Error(fallbackMessage);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readNamedEntity(value: unknown): PurchaseBatchInvoice['supplier'] {
  const record = readRecord(value);
  const id = typeof record.id === 'string' ? record.id : '';
  if (!id) return null;
  return {
    id,
    name: typeof record.name === 'string' ? record.name : null,
    nameAr: typeof record.nameAr === 'string' ? record.nameAr : null,
    nameEn: typeof record.nameEn === 'string' ? record.nameEn : null,
  };
}

export function normalizeFetchedPurchaseBatchInvoices(values: unknown[]): PurchaseBatchInvoice[] {
  const invoices: PurchaseBatchInvoice[] = [];
  for (const value of values) {
    const record = readRecord(value);
    const id = typeof record.id === 'string' ? record.id : '';
    if (!id) continue;

    invoices.push({
      id,
      batchId: typeof record.batchId === 'string' ? record.batchId : null,
      invoiceNumber:
        typeof record.invoiceNumber === 'string' || typeof record.invoiceNumber === 'number'
          ? record.invoiceNumber
          : null,
      supplierInvoiceNumber:
        typeof record.supplierInvoiceNumber === 'string' || typeof record.supplierInvoiceNumber === 'number'
          ? record.supplierInvoiceNumber
          : null,
      supplierId: typeof record.supplierId === 'string' ? record.supplierId : null,
      supplier: readNamedEntity(record.supplier),
      transactionDate:
        typeof record.transactionDate === 'string' || record.transactionDate instanceof Date
          ? record.transactionDate
          : null,
      kind: typeof record.kind === 'string' ? record.kind : null,
      status: typeof record.status === 'string' ? record.status : null,
      totalAmount:
        typeof record.totalAmount === 'string' || typeof record.totalAmount === 'number'
          ? record.totalAmount
          : null,
      netAmount:
        typeof record.netAmount === 'string' || typeof record.netAmount === 'number'
          ? record.netAmount
          : null,
      taxAmount:
        typeof record.taxAmount === 'string' || typeof record.taxAmount === 'number'
          ? record.taxAmount
          : null,
      isTaxable: typeof record.isTaxable === 'boolean' ? record.isTaxable : null,
    });
  }
  return invoices;
}

export function rowWithAdjustedInvoiceDate(
  row: PurchaseBatchEntryRow,
  previousBatchDate: string,
  newBatchDate: string,
): PurchaseBatchEntryRow {
  let invoiceDate = row.invoiceDate;
  if (previousBatchDate && newBatchDate !== previousBatchDate) {
    if (newBatchDate < previousBatchDate && invoiceDate && invoiceDate > newBatchDate) {
      invoiceDate = newBatchDate;
    } else if (newBatchDate > previousBatchDate && invoiceDate === previousBatchDate) {
      invoiceDate = newBatchDate;
    }
  }
  return { ...row, invoiceDate };
}
