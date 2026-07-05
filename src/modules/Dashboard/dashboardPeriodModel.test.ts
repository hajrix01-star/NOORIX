import { describe, expect, it } from 'vitest';
import {
  buildDashboardPeriodFilter,
  buildDashboardYearOptions,
  parseDashboardMonthValue,
} from './dashboardPeriodModel';

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
    const monthNames = ['Jan', 'Feb', 'Mar'];

    expect(buildDashboardPeriodFilter(2026, 2, monthNames)).toEqual({
      year: 2026,
      selectedMonth: 2,
      label: 'Feb 2026',
    });
    expect(buildDashboardPeriodFilter(2026, null, monthNames)).toEqual({
      year: 2026,
      selectedMonth: null,
      label: '2026',
    });
    expect(buildDashboardPeriodFilter(2026, 13, monthNames)).toEqual({
      year: 2026,
      selectedMonth: null,
      label: '2026',
    });
  });
});
