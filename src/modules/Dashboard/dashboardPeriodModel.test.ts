import { describe, expect, it } from 'vitest';
import {
  buildDashboardPeriodFilter,
  buildDashboardYearOptions,
  deriveDashboardPeriodFromDateFilter,
  parseDashboardMonthValue,
} from './dashboardPeriodModel';
import type { DatePeriodState } from '../../utils/datePeriod';

describe('dashboardPeriodModel', () => {
  it('builds descending year options from the current year', () => {
    expect(buildDashboardYearOptions(2026)).toEqual([2026, 2025, 2024]);
    expect(buildDashboardYearOptions(2026, 1)).toEqual([2026]);
  });

  it('normalizes month picker values', () => {
    expect(parseDashboardMonthValue('5')).toBe(5);
    expect(parseDashboardMonthValue(12)).toBe(12);
    expect(parseDashboardMonthValue('')).toBeNull();
    expect(parseDashboardMonthValue('13')).toBeNull();
    expect(parseDashboardMonthValue('abc')).toBeNull();
  });

  it('builds the shared dashboard period label', () => {
    expect(buildDashboardPeriodFilter(2026, 2, 'Feb 2026', '2026-02-01', '2026-02-28', false)).toEqual({
      year: 2026,
      selectedMonth: 2,
      label: 'Feb 2026',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      isCustomRange: false,
    });
    expect(buildDashboardPeriodFilter(2026, null, '2026', '2026-01-01', '2026-12-31', false)).toEqual({
      year: 2026,
      selectedMonth: null,
      label: '2026',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      isCustomRange: false,
    });
    expect(buildDashboardPeriodFilter(2026, 13, '2026', '2026-01-01', '2026-12-31', false)).toEqual({
      year: 2026,
      selectedMonth: null,
      label: '2026',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      isCustomRange: false,
    });
  });

  it('derives dashboard year and month from the full central date filter', () => {
    const state: DatePeriodState = {
      mode: 'months',
      selYear: 2026,
      selMonth: 7,
      selQuarter: 3,
      selDay: '2026-07-08',
      rangeStart: '2026-07-01',
      rangeEnd: '2026-07-08',
      monthRangeStartYear: 2026,
      monthRangeStartMonth: 7,
      monthRangeEndYear: 2026,
      monthRangeEndMonth: 7,
      yearRangeStart: 2026,
      yearRangeEnd: 2026,
    };

    expect(deriveDashboardPeriodFromDateFilter(state, { year: 2026, month: 7, day: 8 })).toEqual({
      year: 2026,
      selectedMonth: 7,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      isCustomRange: false,
    });

    expect(deriveDashboardPeriodFromDateFilter({ ...state, mode: 'quarter', selQuarter: 3 }, { year: 2026, month: 7, day: 8 })).toEqual({
      year: 2026,
      selectedMonth: null,
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      isCustomRange: true,
    });

    expect(deriveDashboardPeriodFromDateFilter({
      ...state,
      mode: 'day',
      selDay: '2025-12-03',
      rangeStart: '2025-12-03',
      rangeEnd: '2025-12-03',
    }, { year: 2026, month: 7, day: 8 })).toEqual({
      year: 2025,
      selectedMonth: 12,
      periodStart: '2025-12-03',
      periodEnd: '2025-12-03',
      isCustomRange: true,
    });
  });
});
