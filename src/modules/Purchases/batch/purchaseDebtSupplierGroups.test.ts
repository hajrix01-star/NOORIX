import { describe, expect, it } from 'vitest';
import type { PurchaseDebtRecord } from '../../../services/api';
import { groupPurchaseDebtsBySupplier } from './purchaseDebtSupplierGroups';

function debt(overrides: Partial<PurchaseDebtRecord>): PurchaseDebtRecord {
  return {
    id: crypto.randomUUID(), supplierId: 's1', supplierInvoiceNumber: 'INV', invoiceDate: '2026-08-01',
    totalAmount: '0', isTaxable: true, notes: null, status: 'pending', createdAt: '2026-08-01T00:00:00Z',
    promotedAt: null, promotionBatchId: null,
    supplier: { id: 's1', nameAr: 'مورد أ', nameEn: 'Supplier A', isTaxRegistered: false },
    ...overrides,
  };
}

describe('groupPurchaseDebtsBySupplier', () => {
  it('groups every displayed invoice under its supplier and preserves exact four-decimal totals', () => {
    const groups = groupPurchaseDebtsBySupplier([
      debt({ id: 'a1', totalAmount: '10.1234' }),
      debt({ id: 'a2', totalAmount: '20.0001', status: 'promoted' }),
      debt({ id: 'b1', supplierId: 's2', totalAmount: '50', status: 'cancelled', supplier: { id: 's2', nameAr: 'مورد ب', nameEn: 'Supplier B', isTaxRegistered: false } }),
    ], 'ar');

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ supplierId: 's2', totalAmount: 50, cancelledCount: 1 });
    expect(groups[1]).toMatchObject({ supplierId: 's1', totalAmount: 30.1235, pendingCount: 1, promotedCount: 1 });
    expect(groups[1].records.map((row) => row.id)).toEqual(['a1', 'a2']);
  });

  it('orders supplier cards and their invoices by the selected business sort', () => {
    const records = [
      debt({ id: 'a1', totalAmount: '100', invoiceDate: '2026-07-05' }),
      debt({ id: 'a2', totalAmount: '20', invoiceDate: '2026-07-01' }),
      debt({ id: 'b1', supplierId: 's2', totalAmount: '50', invoiceDate: '2026-07-03', supplier: { id: 's2', nameAr: 'مورد ب', nameEn: 'Supplier B', isTaxRegistered: false } }),
    ];

    expect(groupPurchaseDebtsBySupplier(records, 'ar', 'supplier_total_asc').map((group) => group.supplierId)).toEqual(['s2', 's1']);
    expect(groupPurchaseDebtsBySupplier(records, 'ar', 'invoice_amount_asc')[0].records.map((row) => row.id)).toEqual(['a2', 'a1']);
    expect(groupPurchaseDebtsBySupplier(records, 'ar', 'invoice_date_desc')[0].records.map((row) => row.id)).toEqual(['a1', 'a2']);
  });
});
