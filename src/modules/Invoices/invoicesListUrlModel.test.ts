import { describe, expect, it } from 'vitest';
import {
  applyInvoiceListKindDrill,
  parseInvoiceListUrlState,
  resolveInvoiceListDateRange,
  resolveInvoiceListKindForApi,
} from './invoicesListUrlModel';

describe('invoicesListUrlModel', () => {
  it('parses invoice drilldown URL state centrally', () => {
    const params = new URLSearchParams({
      from: '2026-01-01',
      to: '2026-01-31',
      kind: 'purchase,expense',
      supplierId: ' supplier-1 ',
      supplierCategoryId: 'cat-1',
      categoryId: 'expense-cat',
      expenseLineId: 'line-1',
      q: ' rent ',
      batchId: 'batch-1',
    });

    expect(parseInvoiceListUrlState(params)).toMatchObject({
      from: '2026-01-01',
      to: '2026-01-31',
      kind: 'purchase,expense',
      supplierId: 'supplier-1',
      supplierCategoryId: 'cat-1',
      categoryId: 'expense-cat',
      expenseLineId: 'line-1',
      q: 'rent',
      batchId: 'batch-1',
      hasDrillValues: true,
    });
  });

  it('splits multi-kind drill state from single-kind filter state', () => {
    expect(applyInvoiceListKindDrill('purchase,expense')).toEqual({
      kind: 'purchase,expense',
      categoryId: '',
      expenseLineId: '',
      filterKind: '',
    });
    expect(applyInvoiceListKindDrill('sale')).toEqual({
      kind: '',
      categoryId: '',
      expenseLineId: '',
      filterKind: 'sale',
    });
  });

  it('resolves date range and API kind without screen logic', () => {
    expect(
      resolveInvoiceListDateRange({
        fromUrl: '2026-02-01',
        toUrl: '2026-02-28',
        fallbackStartDate: '2026-01-01',
        fallbackEndDate: '2026-01-31',
      }),
    ).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28' });

    expect(resolveInvoiceListKindForApi('', 'purchase,expense')).toBe('purchase,expense');
    expect(resolveInvoiceListKindForApi('sale', 'purchase,expense')).toBe('sale');
    expect(resolveInvoiceListKindForApi('', '')).toBeUndefined();
  });
});
