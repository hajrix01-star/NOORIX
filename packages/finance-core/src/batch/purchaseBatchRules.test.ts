import { describe, expect, it } from 'vitest';
import {
  buildPurchaseBatchIdempotencyKey,
  calculatePurchaseBatchSummary,
  isPurchaseBatchLineValid,
} from './purchaseBatchRules';

const taxableSupplierInvoice = {
  kind: 'purchase',
  supplierId: 'supplier-1',
  invoiceNumber: 'INV-1',
  totalInclusive: 115,
  isTaxable: true,
};

describe('purchaseBatchRules', () => {
  it('accepts purchase + supplier + taxable + invoiceNumber', () => {
    expect(isPurchaseBatchLineValid(taxableSupplierInvoice, '')).toBe(true);
  });

  it('rejects purchase + supplier + taxable + no invoiceNumber', () => {
    expect(isPurchaseBatchLineValid({
      kind: 'purchase',
      supplierId: 'supplier-1',
      totalInclusive: 115,
      isTaxable: true,
    }, '')).toBe(false);
  });

  it('accepts purchase + supplier + nonTaxable + no invoiceNumber', () => {
    expect(isPurchaseBatchLineValid({
      kind: 'purchase',
      supplierId: 'supplier-1',
      totalInclusive: 100,
      isTaxable: false,
    }, '')).toBe(true);
  });

  it('accepts expense without supplier when notes and amount exist', () => {
    expect(isPurchaseBatchLineValid({
      kind: 'expense',
      totalInclusive: 75,
      notes: 'service fee',
    }, '')).toBe(true);
  });

  it('accepts fixed_expense without supplier when batchNotes and amount exist', () => {
    expect(isPurchaseBatchLineValid({
      kind: 'fixed_expense',
      totalInclusive: 80,
    }, 'municipality fee')).toBe(true);
  });

  it('rejects row amount <= 0', () => {
    expect(isPurchaseBatchLineValid({
      kind: 'expense',
      totalInclusive: 0,
      notes: 'zero',
    }, '')).toBe(false);
  });

  it('summarizes valid rows only and does not depend on supplierId + invoiceNumber only', () => {
    const summary = calculatePurchaseBatchSummary([
      taxableSupplierInvoice,
      { kind: 'expense', totalInclusive: 50, notes: 'cleaning' },
      { kind: 'fixed_expense', totalInclusive: 25 },
      { kind: 'purchase', supplierId: 'supplier-2', totalInclusive: 200, isTaxable: true },
      { kind: 'expense', totalInclusive: -5, notes: 'bad' },
    ], 'shared note');

    expect(summary.count).toBe(3);
    expect(summary.total).toBe(190);
    expect(summary.net).toBeGreaterThan(0);
    expect(summary.tax).toBeGreaterThan(0);
  });

  it('builds the same idempotency key for the same batch', () => {
    const input = {
      companyId: 'co-1',
      cashAccountId: 'vault-1',
      operationDate: '2026-06-30',
      batchNotes: 'monthly purchases',
      rows: [taxableSupplierInvoice, { kind: 'expense', totalInclusive: 50, notes: 'cleaning' }],
    };

    expect(buildPurchaseBatchIdempotencyKey(input)).toBe(buildPurchaseBatchIdempotencyKey(input));
  });

  it('changes idempotency key when a row amount changes', () => {
    const base = {
      companyId: 'co-1',
      cashAccountId: 'vault-1',
      operationDate: '2026-06-30',
      batchNotes: 'monthly purchases',
      rows: [taxableSupplierInvoice],
    };
    const changed = {
      ...base,
      rows: [{ ...taxableSupplierInvoice, totalInclusive: 116 }],
    };

    expect(buildPurchaseBatchIdempotencyKey(base)).not.toBe(buildPurchaseBatchIdempotencyKey(changed));
  });
});
