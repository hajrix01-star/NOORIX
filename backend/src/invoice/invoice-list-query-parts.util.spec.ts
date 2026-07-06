import { buildInvoiceListQueryParts } from './invoice-list-query-parts.util';
import type { InvoiceListQueryContract } from './invoice-list-query-contract.util';

function query(overrides: Partial<InvoiceListQueryContract> = {}): InvoiceListQueryContract {
  return {
    companyId: 'company-1',
    page: 1,
    pageSize: 50,
    startDate: undefined,
    endDate: undefined,
    batchId: undefined,
    employeeId: undefined,
    kind: undefined,
    supplierId: undefined,
    supplierCategoryId: undefined,
    categoryId: undefined,
    expenseLineId: undefined,
    vaultId: undefined,
    createdByUserId: undefined,
    sortBy: 'transactionDate',
    sortDir: 'desc',
    q: undefined,
    includeCancelled: false,
    hasNotes: undefined,
    requireExpenseLine: undefined,
    ...overrides,
  };
}

describe('buildInvoiceListQueryParts', () => {
  it('uses normalized CSV tokens for invoice kinds', () => {
    const { where } = buildInvoiceListQueryParts(query({ kind: ' purchase, expense, purchase, ' }));
    expect(where).toMatchObject({ kind: { in: ['purchase', 'expense'] } });
  });

  it('applies notes filter only from the normalized boolean contract', () => {
    expect(buildInvoiceListQueryParts(query({ hasNotes: true })).where).toMatchObject({
      AND: [{ notes: { not: null } }, { NOT: { notes: { equals: '' } } }],
    });
    expect(buildInvoiceListQueryParts(query()).where).not.toHaveProperty('AND');
  });
});
