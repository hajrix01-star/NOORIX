import { describe, expect, it } from 'vitest';
import {
  dashboardLastDayOfMonth,
  dashboardMonthFromYmd,
  dashboardYmd,
  splitDashboardSpecialDayByMonth,
} from './dashboardSpecialDaysModel';

describe('dashboardSpecialDaysModel', () => {
  it('formats dates and extracts valid months', () => {
    expect(dashboardYmd(2026, 3, 7)).toBe('2026-03-07');
    expect(dashboardMonthFromYmd('2026-12-31')).toBe(12);
    expect(dashboardMonthFromYmd('2026-00-31')).toBeNull();
    expect(dashboardLastDayOfMonth(2024, 2)).toBe(29);
  });

  it('splits a special day range into the affected dashboard months', () => {
    expect(
      splitDashboardSpecialDayByMonth('sp-1', 'Ramadan', '#8b5cf6', '2026-02-20', '2026-04-10'),
    ).toEqual([
      { id: 'sp-1', name: 'Ramadan', color: '#8b5cf6', fromDate: '2026-02-20', toDate: '2026-02-28' },
      { id: 'sp-1', name: 'Ramadan', color: '#8b5cf6', fromDate: '2026-03-01', toDate: '2026-03-31' },
      { id: 'sp-1', name: 'Ramadan', color: '#8b5cf6', fromDate: '2026-04-01', toDate: '2026-04-10' },
    ]);
  });

  it('keeps cross-year ranges as a single row for the caller to store intentionally', () => {
    expect(
      splitDashboardSpecialDayByMonth('sp-2', 'Holiday', '#84cc16', '2026-12-29', '2027-01-03'),
    ).toEqual([
      { id: 'sp-2', name: 'Holiday', color: '#84cc16', fromDate: '2026-12-29', toDate: '2027-01-03' },
    ]);
  });
});
