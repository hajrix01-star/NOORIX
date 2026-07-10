import {
  buildActiveSalesSummaryShiftDuplicateWhere,
  normalizeSalesSummaryShift,
} from './sales-summary-duplicate.util';

describe('sales summary duplicate guard', () => {
  it('builds an active same-day same-shift duplicate query', () => {
    const where = buildActiveSalesSummaryShiftDuplicateWhere({
      companyId: 'company-1',
      transactionDate: '2026-07-10',
      shift: 'morning',
    });

    expect(where).toMatchObject({
      companyId: 'company-1',
      status: 'active',
      shift: 'morning',
      transactionDate: {
        gte: new Date('2026-07-10T00:00:00.000Z'),
        lte: new Date('2026-07-10T23:59:59.999Z'),
      },
    });
    expect(where).not.toHaveProperty('NOT');
  });

  it('can exclude the current summary while editing', () => {
    const where = buildActiveSalesSummaryShiftDuplicateWhere({
      companyId: 'company-1',
      transactionDate: new Date('2026-07-10T12:30:00.000Z'),
      shift: 'evening',
      excludeId: 'summary-1',
    });

    expect(where).toMatchObject({
      companyId: 'company-1',
      status: 'active',
      shift: 'evening',
      NOT: { id: 'summary-1' },
    });
  });

  it('normalizes unknown shifts to full day', () => {
    expect(normalizeSalesSummaryShift('morning')).toBe('morning');
    expect(normalizeSalesSummaryShift('evening')).toBe('evening');
    expect(normalizeSalesSummaryShift('all')).toBe('all');
    expect(normalizeSalesSummaryShift('bad-value')).toBe('all');
  });
});
