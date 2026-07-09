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
        includeCancelled: false,
        hasNotes: true,
        vaultId: 'vault-1',
        batchId: 'batch-1',
        createdByUserId: '__none__',
      }),
    ).toMatchObject({
      companyId: 'co1',
      kind: 'purchase',
      includeCancelled: false,
      hasNotes: true,
      categoryId: 'cat-1',
      expenseLineId: 'line-1',
      q: 'invoice',
      vaultId: 'vault-1',
      batchId: 'batch-1',
      createdByUserId: '__none__',
    });
  });

  it('keeps cancelled invoices in export only when the toolbar filter allows them', () => {
    const base = {
      companyId: 'co1',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      filterKind: '',
      urlExtra: {
        kind: '',
        categoryId: '',
        expenseLineId: '',
      },
      sortBy: 'transactionDate',
      sortDir: 'desc',
      supplierId: '',
      supplierCategoryId: '',
      q: '',
      hasNotes: false,
      vaultId: '',
      batchId: '',
      createdByUserId: '',
    };

    expect(buildInvoiceImportExportFetchParams({ ...base, includeCancelled: false }).includeCancelled).toBe(false);
    expect(buildInvoiceImportExportFetchParams({ ...base, includeCancelled: true }).includeCancelled).toBe(true);
  });
});
