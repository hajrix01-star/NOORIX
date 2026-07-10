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

  it('hides cancelled invoices unless the toolbar explicitly includes them', () => {
    expect(buildInvoiceListQueryParts(query({ includeCancelled: false })).where).toMatchObject({
      status: 'active',
    });
    expect(buildInvoiceListQueryParts(query({ includeCancelled: true })).where).not.toHaveProperty('status');
  });

  it('applies supplier and supplier category filters from multi-select controls', () => {
    const { where } = buildInvoiceListQueryParts(
      query({
        supplierId: 'supplier-1,supplier-2',
        supplierCategoryId: 'category-1,category-2',
      }),
    );

    expect(where).toMatchObject({
      supplierId: { in: ['supplier-1', 'supplier-2'] },
      supplier: { is: { supplierCategoryId: { in: ['category-1', 'category-2'] } } },
    });
  });

  it('filters vaults by direct vault and split allocations', () => {
    const { where } = buildInvoiceListQueryParts(query({ vaultId: 'vault-1' }));

    expect(where).toMatchObject({
      OR: [{ vaultId: 'vault-1' }, { vaultAllocations: { some: { vaultId: 'vault-1' } } }],
    });
  });

  it('supports created-by user filters including unrecorded invoices', () => {
    expect(buildInvoiceListQueryParts(query({ createdByUserId: '__none__' })).where).toMatchObject({
      createdByUserId: null,
    });
    expect(buildInvoiceListQueryParts(query({ createdByUserId: 'user-1,__none__' })).where).toMatchObject({
      OR: [{ createdByUserId: null }, { createdByUserId: { in: ['user-1'] } }],
    });
  });
});
