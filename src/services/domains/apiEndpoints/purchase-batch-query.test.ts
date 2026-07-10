import { describe, expect, it } from 'vitest';
import {
  buildPurchaseBatchSummariesApiQuery,
  normalizePurchaseBatchSummariesQueryInput,
} from './purchase-batch-query';

describe('purchase-batch-query', () => {
  it('normalizes purchase batch query input for cache keys', () => {
    expect(
      normalizePurchaseBatchSummariesQueryInput({
        companyId: ' company-1 ',
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

  it('builds GET /purchase-batch-summaries query params centrally', () => {
    expect(
      buildPurchaseBatchSummariesApiQuery({
        companyId: 'company-1',
        startDate: '2026-07-01',
        endDate: '',
        q: ' ',
        lang: 'ar',
      }),
    ).toEqual({
      companyId: 'company-1',
      lang: 'ar',
      startDate: '2026-07-01',
    });
  });

  it('limits search text in cache keys and API params', () => {
    const query = normalizePurchaseBatchSummariesQueryInput({
      companyId: 'company-1',
      q: 'x'.repeat(140),
    });

    expect(query.q).toHaveLength(120);
    expect(buildPurchaseBatchSummariesApiQuery(query).q).toHaveLength(120);
  });
});
