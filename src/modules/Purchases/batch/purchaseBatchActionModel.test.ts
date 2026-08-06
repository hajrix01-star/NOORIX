import { describe, expect, it } from 'vitest';
import {
  buildPurchaseBatchItemPayload,
  requirePurchaseBatchSaveResult,
  rowWithAdjustedInvoiceDate,
} from './purchaseBatchActionModel';
import type { BatchTranslateFn, PurchaseBatchEntryRow } from './purchaseBatchTypes';

const t: BatchTranslateFn = (key) => {
  const labels: Record<string, string> = {
    expenseType: 'Expense',
    fixedExpenseType: 'Fixed expense',
  };
  return labels[key] ?? key;
};

function row(overrides: Partial<PurchaseBatchEntryRow> = {}): PurchaseBatchEntryRow {
  return {
    key: 'row-1',
    kind: 'purchase',
    supplierId: 'supplier-1',
    invoiceNumber: 'INV-1',
    totalInclusive: '115',
    invoiceDate: '2026-01-10',
    isTaxable: true,
    categoryId: 'category-1',
    debitAccountId: 'account-1',
    notes: '',
    warrantyFollowUp: false,
    attachmentFile: null,
    ...overrides,
  };
}

describe('purchaseBatchActionModel', () => {
  it('builds a normalized save payload from a row', () => {
    expect(buildPurchaseBatchItemPayload(row({ legacyDebtId: 'debt-1', warrantyFollowUp: true }), t)).toMatchObject({
      legacyDebtId: 'debt-1',
      supplierId: 'supplier-1',
      supplierInvoiceNumber: 'INV-1',
      kind: 'purchase',
      totalAmount: 115,
      isTaxable: true,
      invoiceDate: '2026-01-10',
      warrantyFollowUp: true,
    });
  });

  it('prefixes expense notes', () => {
    expect(buildPurchaseBatchItemPayload(row({ kind: 'expense', notes: 'Fuel' }), t).notes).toBe('Expense - Fuel');
  });

  it('keeps invoice dates inside the new batch date', () => {
    expect(rowWithAdjustedInvoiceDate(row({ invoiceDate: '2026-02-10' }), '2026-02-15', '2026-02-01').invoiceDate)
      .toBe('2026-02-01');
  });

  it('requires a concrete save result from the backend', () => {
    const result = { batchId: 'B-1', count: 1, invoices: [{ id: 'invoice-1' }] };
    expect(requirePurchaseBatchSaveResult(result, 'Save failed')).toBe(result);
    expect(() => requirePurchaseBatchSaveResult(undefined, 'Save failed')).toThrow('Save failed');
  });
});
