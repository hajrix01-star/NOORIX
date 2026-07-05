import { describe, expect, it } from 'vitest';
import { buildInvoiceListFetchParams } from './invoicesListQueryModel';

describe('invoicesListQueryModel', () => {
  it('normalizes empty filter values to undefined for API fetches', () => {
    const params = buildInvoiceListFetchParams({
      companyId: 'co1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      kind: '',
      sortBy: 'transactionDate',
      sortDir: 'desc',
      supplierId: ' ',
      supplierCategoryId: '',
      q: '  ',
      categoryId: '',
      expenseLineId: '',
      includeCancelled: false,
      hasNotes: false,
      vaultId: '',
      batchId: '',
      createdByUserId: '',
    });

    expect(params).toMatchObject({
      companyId: 'co1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      kind: undefined,
      supplierId: undefined,
      supplierCategoryId: undefined,
      q: undefined,
      includeCancelled: false,
      hasNotes: undefined,
      vaultId: undefined,
      batchId: undefined,
      createdByUserId: undefined,
    });
  });

  it('preserves active filters for export and print fetches', () => {
    const params = buildInvoiceListFetchParams({
      companyId: 'co1',
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      kind: 'purchase,expense',
      sortBy: 'totalAmount',
      sortDir: 'asc',
      supplierId: 's1',
      supplierCategoryId: 'cat1',
      q: ' invoice ',
      categoryId: 'expense-cat',
      expenseLineId: 'line1',
      includeCancelled: true,
      hasNotes: true,
      vaultId: 'v1',
      batchId: 'b1',
      createdByUserId: '__none__',
    });

    expect(params).toEqual({
      companyId: 'co1',
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      kind: 'purchase,expense',
      sortBy: 'totalAmount',
      sortDir: 'asc',
      supplierId: 's1',
      supplierCategoryId: 'cat1',
      q: 'invoice',
      categoryId: 'expense-cat',
      expenseLineId: 'line1',
      includeCancelled: true,
      hasNotes: true,
      vaultId: 'v1',
      batchId: 'b1',
      createdByUserId: '__none__',
    });
  });
});
