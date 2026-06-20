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
  it('uses calendar days for completed months and current month MTD', () => {
    const rows = buildYearMonthlyDailyAvgRows({
      year: 2026,
      yearSummaries: [
        { transactionDate: '2026-01-01', totalAmount: 100 },
        { transactionDate: '2026-01-02', totalAmount: 200 },
        { transactionDate: '2026-02-01', totalAmount: 400 },
        { transactionDate: '2026-05-10', totalAmount: 500 },
        { transactionDate: '2026-05-20', totalAmount: 700 },
      ],
      monthNames: MONTHS,
      capMonth: 5,
      currentYear: 2026,
      currentMonth: 5,
      currentDay: 20,
    });

    expect(rows).toHaveLength(5);
    expect(rows[0].totalSales).toBe(300);
    expect(rows[0].avgDaily).toBeCloseTo(300 / 31, 4);
    expect(rows[0].calendarDays).toBe(31);
    expect(rows[1].avgDaily).toBeCloseTo(400 / 28, 4);
    expect(rows[2].avgDaily).toBeNull();
    expect(rows[4].totalSales).toBe(1200);
    expect(rows[4].avgDaily).toBe(60);
    expect(rows[4].calendarDays).toBe(20);
    expect(rows[4].isCurrentMonth).toBe(true);
  });

  it('caps previous month to prevMonthAlignEndDay when viewing current month MTD', () => {
    const rows = buildYearMonthlyDailyAvgRows({
      year: 2026,
      yearSummaries: [
        { transactionDate: '2026-04-10', totalAmount: 1000 },
        { transactionDate: '2026-04-20', totalAmount: 1000 },
        { transactionDate: '2026-04-28', totalAmount: 10000 },
        { transactionDate: '2026-05-10', totalAmount: 500 },
      ],
      monthNames: MONTHS,
      capMonth: 5,
      currentYear: 2026,
      currentMonth: 5,
      currentDay: 10,
      prevMonthAlignEndDay: 20,
    });

    const april = rows[3];
    expect(april.month).toBe(4);
    expect(april.totalSales).toBe(2000);
    expect(april.avgDaily).toBe(100);
    expect(april.calendarDays).toBe(20);
  });
});
