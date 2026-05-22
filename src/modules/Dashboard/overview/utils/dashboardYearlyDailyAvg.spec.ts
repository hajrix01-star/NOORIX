import { describe, expect, it } from 'vitest';
import {
  buildYearMonthlyDailyAvgRows,
  yearMonthlyDailyAvgCapMonth,
} from './dashboardOverviewBuilders';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];

describe('yearMonthlyDailyAvgCapMonth', () => {
  it('caps at current month for the active year', () => {
    expect(yearMonthlyDailyAvgCapMonth(2026, 2026, 5)).toBe(5);
  });

  it('returns 12 for past years', () => {
    expect(yearMonthlyDailyAvgCapMonth(2025, 2026, 5)).toBe(12);
  });

  it('returns 0 for future years', () => {
    expect(yearMonthlyDailyAvgCapMonth(2027, 2026, 5)).toBe(0);
  });
});

describe('buildYearMonthlyDailyAvgRows', () => {
  it('computes active-day averages Jan through cap month', () => {
    const rows = buildYearMonthlyDailyAvgRows({
      year: 2026,
      yearSummaries: [
        { transactionDate: '2026-01-01', totalAmount: 100 },
        { transactionDate: '2026-01-02', totalAmount: 200 },
        { transactionDate: '2026-02-01', totalAmount: 400 },
        { transactionDate: '2026-02-02', totalAmount: 0 },
        { transactionDate: '2026-05-10', totalAmount: 500 },
        { transactionDate: '2026-05-20', totalAmount: 700 },
      ],
      monthNames: MONTHS,
      capMonth: 5,
      currentYear: 2026,
      currentMonth: 5,
    });

    expect(rows).toHaveLength(5);
    expect(rows[0].avgDaily).toBe(150);
    expect(rows[0].activeDays).toBe(2);
    expect(rows[1].avgDaily).toBe(400);
    expect(rows[1].activeDays).toBe(1);
    expect(rows[2].avgDaily).toBeNull();
    expect(rows[4].avgDaily).toBe(600);
    expect(rows[4].isCurrentMonth).toBe(true);
    expect(rows[4].deltaPctVsPrev).toBe(50);
  });
});
