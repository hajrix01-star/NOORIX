import { describe, it, expect } from 'vitest';
import { reportingInsightsKeys } from './reportingInsightsKeys';

describe('reportingInsightsKeys', () => {
  it('dashboard key is stable for identical inputs', () => {
    const input = {
      companyId: 'c1',
      year: 2026,
      yearStart: '2026-01-01',
      yearEnd: '2026-12-31',
      dailyStart: null as string | null,
      dailyEnd: null as string | null,
      monthStart: '2026-03-01' as string | null,
      monthEnd: '2026-03-31' as string | null,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      selectedMonth: 3 as number | null,
      includeCancelledSales: false,
    };
    expect(reportingInsightsKeys.dashboard(input)).toEqual(reportingInsightsKeys.dashboard(input));
  });

  it('root key prefix', () => {
    expect(reportingInsightsKeys.root()).toEqual(['reporting-insights']);
  });
});
