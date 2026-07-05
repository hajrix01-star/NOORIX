import { describe, expect, it } from 'vitest';
import {
  buildDashboardPeriodQuery,
  hasRequiredDashboardPeriodParams,
  normalizeDashboardPeriodKeyInput,
} from './dashboard-period-query';

describe('buildDashboardPeriodQuery', () => {
  it('normalizes shared dashboard date query params', () => {
    expect(
      buildDashboardPeriodQuery({
        companyId: 'company-1',
        year: 2026,
        yearStart: '2026-01-01T00:00:00.000Z',
        yearEnd: '2026-12-31T00:00:00.000Z',
        periodStart: '2026-07-01T00:00:00.000Z',
        periodEnd: '2026-07-31T00:00:00.000Z',
        dailyStart: '2026-07-05T00:00:00.000Z',
        dailyEnd: '',
        monthStart: null,
        monthEnd: '2026-07-31',
        selectedMonth: 7,
        includeCancelledSales: true,
      }),
    ).toEqual({
      companyId: 'company-1',
      year: 2026,
      yearStart: '2026-01-01',
      yearEnd: '2026-12-31',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      dailyStart: '2026-07-05',
      monthEnd: '2026-07-31',
      selectedMonth: 7,
      includeCancelledSales: true,
    });
  });

  it('drops invalid optional month values instead of sending drift to the API', () => {
    expect(
      buildDashboardPeriodQuery({
        companyId: 'company-1',
        year: 2026,
        yearStart: '2026-01-01',
        yearEnd: '2026-12-31',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        selectedMonth: 13,
      }),
    ).not.toHaveProperty('selectedMonth');
  });

  it('builds a normalized query key input for dashboard cache keys', () => {
    expect(
      normalizeDashboardPeriodKeyInput({
        companyId: '  company-1  ',
        year: 2026,
        yearStart: '2026-01-01T00:00:00.000Z',
        yearEnd: '2026-12-31T00:00:00.000Z',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        selectedMonth: 0,
      }),
    ).toEqual({
      companyId: 'company-1',
      year: 2026,
      yearStart: '2026-01-01',
      yearEnd: '2026-12-31',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      dailyStart: null,
      dailyEnd: null,
      monthStart: null,
      monthEnd: null,
      selectedMonth: null,
      includeCancelledSales: false,
    });
  });

  it('validates required dashboard period query inputs centrally', () => {
    expect(
      hasRequiredDashboardPeriodParams({
        companyId: 'company-1',
        year: 2026,
        yearStart: '2026-01-01',
        yearEnd: '2026-12-31',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
      }),
    ).toBe(true);

    expect(
      hasRequiredDashboardPeriodParams({
        companyId: '',
        year: 1999,
        yearStart: '2026-01-01',
        yearEnd: '2026-12-31',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
      }),
    ).toBe(false);
  });
});
