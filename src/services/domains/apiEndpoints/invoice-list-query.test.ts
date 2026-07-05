import { describe, expect, it } from 'vitest';
import { buildInvoiceListApiQuery, buildInvoiceListFetchParams } from './invoice-list-query';

describe('invoice-list-query', () => {
  it('normalizes invoice list fetch params used by screens and actions', () => {
    expect(
      buildInvoiceListFetchParams({
        companyId: 'company-1',
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-07-31T00:00:00.000Z',
        kind: ' purchase ',
        sortBy: '',
        sortDir: '',
        q: ' INV-1 ',
        includeCancelled: false,
        hasNotes: false,
      }),
    ).toEqual({
      companyId: 'company-1',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      kind: 'purchase',
      sortBy: 'transactionDate',
      sortDir: 'desc',
      supplierId: undefined,
      supplierCategoryId: undefined,
      q: 'INV-1',
      categoryId: undefined,
      expenseLineId: undefined,
      includeCancelled: false,
      hasNotes: undefined,
      vaultId: undefined,
      batchId: undefined,
      createdByUserId: undefined,
    });
  });

  it('builds the API query sent to GET /invoices', () => {
    expect(
      buildInvoiceListApiQuery({
        companyId: 'company-1',
        page: 0,
        pageSize: 500,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        vaultId: ' vault-1 ',
        includeCancelled: true,
        hasNotes: true,
        requireExpenseLine: true,
      }),
    ).toEqual({
      companyId: 'company-1',
      page: '1',
      pageSize: '200',
      includeCancelled: 'true',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      sortBy: 'transactionDate',
      sortDir: 'desc',
      vaultId: 'vault-1',
      hasNotes: 'true',
      requireExpenseLine: 'true',
    });
  });
});
