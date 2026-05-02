import {
  assertOutflowBatchNoDuplicateSupplierInvoiceKeys,
  normalizeSupplierInvoiceDedupKey,
  computeSupplierInvoiceDedupKeyForInvoiceRow,
} from './invoice-supplier-invoice-dedup.util';
import type { OutflowDto } from '../financial-core/dto/financial-operation.dto';

describe('normalizeSupplierInvoiceDedupKey', () => {
  it('trims and removes inner spaces', () => {
    expect(normalizeSupplierInvoiceDedupKey('  AB  12  ')).toBe('ab12');
  });

  it('converts Eastern Arabic and Persian digits', () => {
    expect(normalizeSupplierInvoiceDedupKey('فاتورة ١٢٣')).toBe('فاتورة123');
    expect(normalizeSupplierInvoiceDedupKey('۴۵۶')).toBe('456');
  });

  it('returns null for empty', () => {
    expect(normalizeSupplierInvoiceDedupKey('')).toBe(null);
    expect(normalizeSupplierInvoiceDedupKey('   ')).toBe(null);
    expect(normalizeSupplierInvoiceDedupKey(null)).toBe(null);
  });
});

describe('computeSupplierInvoiceDedupKeyForInvoiceRow', () => {
  it('returns null when not active or no supplier', () => {
    expect(
      computeSupplierInvoiceDedupKeyForInvoiceRow({
        supplierId: 's1',
        kind: 'purchase',
        supplierInvoiceNumber: '99',
        status: 'cancelled',
      }),
    ).toBe(null);
    expect(
      computeSupplierInvoiceDedupKeyForInvoiceRow({
        supplierId: null,
        kind: 'purchase',
        supplierInvoiceNumber: '99',
        status: 'active',
      }),
    ).toBe(null);
  });
});

describe('assertOutflowBatchNoDuplicateSupplierInvoiceKeys', () => {
  const base = (over: Partial<OutflowDto>): OutflowDto =>
    ({
      companyId: 'c1',
      supplierId: 'sup1',
      kind: 'purchase',
      totalAmount: '100',
      netAmount: '86.9565',
      taxAmount: '13.0435',
      transactionDate: '2026-01-01',
      supplierInvoiceNumber: 'INV-1',
      ...over,
    }) as OutflowDto;

  it('throws when two lines share same supplier and normalized supplier invoice number', () => {
    expect(() =>
      assertOutflowBatchNoDuplicateSupplierInvoiceKeys([
        base({ supplierInvoiceNumber: 'INV 1' }),
        base({ supplierInvoiceNumber: 'inv1' }),
      ]),
    ).toThrow(/تكرار داخل الدفعة/);
  });

  it('allows different suppliers with same number', () => {
    expect(() =>
      assertOutflowBatchNoDuplicateSupplierInvoiceKeys([
        base({ supplierId: 'a', supplierInvoiceNumber: '1' }),
        base({ supplierId: 'b', supplierInvoiceNumber: '1' }),
      ]),
    ).not.toThrow();
  });
});
