import { normalizeInvoiceListQuery } from './invoice-list-query-contract.util';

describe('normalizeInvoiceListQuery', () => {
  it('normalizes invoice list query values for the backend service contract', () => {
    expect(
      normalizeInvoiceListQuery(
        'company-1',
        {
          page: 0,
          pageSize: 500,
          startDate: '2026-07-01T00:00:00.000Z',
          endDate: '2026-07-31T00:00:00.000Z',
          supplierId: ' supplier-1 ',
          vaultId: ' vault-1,vault-2 ',
          q: '  INV-10  ',
          includeCancelled: true,
          hasNotes: true,
          requireExpenseLine: false,
        },
        'purchase,expense',
      ),
    ).toEqual({
      companyId: 'company-1',
      page: 1,
      pageSize: 200,
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      batchId: undefined,
      employeeId: undefined,
      kind: 'purchase,expense',
      supplierId: 'supplier-1',
      supplierCategoryId: undefined,
      categoryId: undefined,
      expenseLineId: undefined,
      vaultId: 'vault-1,vault-2',
      createdByUserId: undefined,
      sortBy: 'transactionDate',
      sortDir: 'desc',
      q: 'INV-10',
      includeCancelled: true,
      hasNotes: true,
      requireExpenseLine: undefined,
    });
  });

  it('uses safe defaults when optional values are empty', () => {
    expect(
      normalizeInvoiceListQuery('company-1', {
        sortBy: '',
        sortDir: '',
        includeCancelled: false,
      }),
    ).toMatchObject({
      companyId: 'company-1',
      page: 1,
      pageSize: 50,
      sortBy: 'transactionDate',
      sortDir: 'desc',
      includeCancelled: false,
    });
  });
});
