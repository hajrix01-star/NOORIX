import { describe, expect, it, vi } from 'vitest';
import { buildInvoiceListActionFetchParams } from './useInvoicesListActions';

const t = (key: string) => key;

function actionParams(overrides = {}) {
  return {
    companyId: 'company-1',
    displayedTotal: 10,
    invoiceQueryStartDate: '2026-07-01',
    invoiceQueryEndDate: '2026-07-31',
    dateFilterLabel: 'Jul 2026',
    fromUrl: '',
    toUrl: '',
    kindForApi: 'purchase,expense',
    sortKey: 'totalAmount',
    sortDir: 'asc',
    filterSupplierId: 'supplier-1,supplier-2',
    filterSupplierCategoryId: 'supplier-category-1',
    debouncedQ: ' INV-1 ',
    urlExtra: {
      categoryId: 'category-1',
      expenseLineId: 'line-1',
    },
    showCancelled: false,
    filterHasNotesOnly: true,
    filterVaultId: 'vault-1',
    invoiceBatchIdFromUrl: 'batch-1',
    filterCreatedByUserId: '__none__',
    mapInvoiceToExportRow: vi.fn(),
    exportColumnDefs: [],
    companyName: 'Company',
    logoUrl: '',
    lang: 'ar',
    t,
    fmt: (value: number) => String(value),
    showToast: vi.fn(),
    setExportBusy: vi.fn(),
    serverAll: {
      count: 10,
      net: 100,
      tax: 15,
      total: 115,
    },
    ...overrides,
  };
}

describe('useInvoicesListActions', () => {
  it('uses the exact visible invoice filters for print and Excel fetches', () => {
    expect(buildInvoiceListActionFetchParams(actionParams())).toEqual({
      companyId: 'company-1',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      kind: 'purchase,expense',
      sortBy: 'totalAmount',
      sortDir: 'asc',
      supplierId: 'supplier-1,supplier-2',
      supplierCategoryId: 'supplier-category-1',
      q: 'INV-1',
      categoryId: 'category-1',
      expenseLineId: 'line-1',
      includeCancelled: false,
      hasNotes: true,
      vaultId: 'vault-1',
      batchId: 'batch-1',
      createdByUserId: '__none__',
    });
  });

  it('includes cancelled invoices in actions only when the toolbar toggle is enabled', () => {
    expect(buildInvoiceListActionFetchParams(actionParams({ showCancelled: false })).includeCancelled).toBe(false);
    expect(buildInvoiceListActionFetchParams(actionParams({ showCancelled: true })).includeCancelled).toBe(true);
  });
});
