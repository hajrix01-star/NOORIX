import { describe, expect, it } from 'vitest';
import { buildInvoiceImportExportFetchParams } from './invoicesListImportExportModel';

describe('invoicesListImportExportModel', () => {
  it('uses the first URL multi-kind value for import/export template compatibility', () => {
    expect(
      buildInvoiceImportExportFetchParams({
        companyId: 'co1',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        filterKind: '',
        urlExtra: {
          kind: 'purchase,expense',
          categoryId: 'cat-1',
          expenseLineId: 'line-1',
        },
        sortBy: 'transactionDate',
        sortDir: 'desc',
        supplierId: 'supplier-1',
        supplierCategoryId: '',
        q: ' invoice ',
        hasNotes: true,
        vaultId: 'vault-1',
        batchId: 'batch-1',
        createdByUserId: '__none__',
      }),
    ).toMatchObject({
      companyId: 'co1',
      kind: 'purchase',
      includeCancelled: true,
      hasNotes: true,
      categoryId: 'cat-1',
      expenseLineId: 'line-1',
      q: 'invoice',
      vaultId: 'vault-1',
      batchId: 'batch-1',
      createdByUserId: '__none__',
    });
  });
});
