import { describe, expect, it } from 'vitest';
import {
  buildPurchaseDebtBatchRows,
  isPurchaseDebtBatchRowEmpty,
  validatePurchaseDebtBatchRows,
} from './purchaseDebtBatchModels';

const messages = {
  supplier: 'supplier', invoice: 'invoice', date: 'date', futureDate: 'future', amount: 'amount', duplicate: 'duplicate',
};

describe('purchaseDebtBatchModels', () => {
  it('ignores untouched rows although they carry the default date and VAT choice', () => {
    const [row] = buildPurchaseDebtBatchRows(1, '2026-08-06');
    expect(isPurchaseDebtBatchRowEmpty(row)).toBe(true);
    expect(validatePurchaseDebtBatchRows([row], '2026-08-06', messages).items).toEqual([]);
  });

  it('rejects the whole draft when one entered row is incomplete', () => {
    const rows = buildPurchaseDebtBatchRows(2, '2026-08-06');
    rows[0] = { ...rows[0], supplierId: 'supplier-1', supplierInvoiceNumber: 'INV-1', totalAmount: '100' };
    rows[1] = { ...rows[1], supplierId: 'supplier-2', totalAmount: '200' };
    const result = validatePurchaseDebtBatchRows(rows, '2026-08-06', messages);
    expect(result.items).toEqual([]);
    expect(result.errorsByKey.get(rows[1].key)?.supplierInvoiceNumber).toBe('invoice');
  });

  it('detects normalized duplicates for the same supplier', () => {
    const rows = buildPurchaseDebtBatchRows(2, '2026-08-06');
    rows[0] = { ...rows[0], supplierId: 'supplier-1', supplierInvoiceNumber: ' INV ١٢ ', totalAmount: '100' };
    rows[1] = { ...rows[1], supplierId: 'supplier-1', supplierInvoiceNumber: 'inv12', totalAmount: '200' };
    const result = validatePurchaseDebtBatchRows(rows, '2026-08-06', messages);
    expect(result.items).toEqual([]);
    expect(result.errorsByKey.get(rows[0].key)?.duplicate).toBe('duplicate');
    expect(result.errorsByKey.get(rows[1].key)?.duplicate).toBe('duplicate');
  });

  it('builds a complete payload and summary for valid rows', () => {
    const rows = buildPurchaseDebtBatchRows(2, '2026-08-06');
    rows[0] = { ...rows[0], supplierId: 'supplier-1', supplierInvoiceNumber: 'INV-1', totalAmount: '100.25' };
    rows[1] = { ...rows[1], supplierId: 'supplier-2', supplierInvoiceNumber: 'INV-2', totalAmount: '200', isTaxable: false };
    const result = validatePurchaseDebtBatchRows(rows, '2026-08-06', messages);
    expect(result.errorsByKey.size).toBe(0);
    expect(result.items).toHaveLength(2);
    expect(result.totalAmount).toBe(300.25);
  });
});
