import { normalizePurchaseBatchSummariesQuery } from './purchase-batch-summaries-query-contract.util';

describe('normalizePurchaseBatchSummariesQuery', () => {
  it('normalizes purchase batch summaries query params', () => {
    expect(
      normalizePurchaseBatchSummariesQuery('company-1', {
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-07-31T00:00:00.000Z',
        q: '  supplier  ',
        lang: 'en',
      }),
    ).toEqual({
      companyId: 'company-1',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      q: 'supplier',
      lang: 'en',
    });
  });

  it('defaults language to Arabic and drops empty values', () => {
    expect(
      normalizePurchaseBatchSummariesQuery('company-1', {
        q: ' ',
        lang: 'fr',
      }),
    ).toEqual({
      companyId: 'company-1',
      startDate: undefined,
      endDate: undefined,
      q: undefined,
      lang: 'ar',
    });
  });

  it('limits search text to the supported query length', () => {
    expect(
      normalizePurchaseBatchSummariesQuery('company-1', {
        q: 'x'.repeat(140),
      }).q,
    ).toHaveLength(120);
  });
});
