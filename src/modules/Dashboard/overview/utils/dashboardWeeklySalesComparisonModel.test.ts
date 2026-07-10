import { describe, expect, it } from 'vitest';
import {
  buildDashboardWeeklySalesComparisonRows,
  buildDashboardWeeklySalesComparisonRowsFromDaily,
} from './dashboardWeeklySalesComparisonModel';

describe('dashboardWeeklySalesComparisonModel', () => {
  it('builds comparison rows from backend weekly metric buckets', () => {
    const result = buildDashboardWeeklySalesComparisonRows(
      [
        { weekIndex: 1, dayStart: 1, dayEnd: 7, totalSales: 700, avgDailyInWeek: 100, calendarDaysInSlice: 7 },
        { weekIndex: 2, dayStart: 8, dayEnd: 14, totalSales: 1400, avgDailyInWeek: 200, calendarDaysInSlice: 7 },
      ],
      [
        { weekIndex: 1, dayStart: 1, dayEnd: 7, totalSales: 350, avgDailyInWeek: 50, calendarDaysInSlice: 7 },
        { weekIndex: 2, dayStart: 8, dayEnd: 14, totalSales: 1400, avgDailyInWeek: 200, calendarDaysInSlice: 7 },
      ],
    );

    expect(result.rows).toEqual([
      {
        weekIndex: 1,
        dayStart: 1,
        dayEnd: 7,
        avgDailyCurrent: 100,
        avgDailyBaseline: 50,
        deltaPct: 100,
      },
      {
        weekIndex: 2,
        dayStart: 8,
        dayEnd: 14,
        avgDailyCurrent: 200,
        avgDailyBaseline: 200,
        deltaPct: 0,
      },
    ]);
  });

  it('does not invent missing backend weekly rows', () => {
    const result = buildDashboardWeeklySalesComparisonRows([], []);

    expect(result.rows).toEqual([]);
  });

  it('compares an in-progress week against the same number of baseline days', () => {
    const result = buildDashboardWeeklySalesComparisonRowsFromDaily({
      currentYear: 2026,
      currentMonth: 7,
      baselineYear: 2026,
      baselineMonth: 6,
      currentMaxDayInclusive: 10,
      current: [
        { transactionDate: '2026-07-08', totalAmount: 9000, customerCount: 0 },
        { transactionDate: '2026-07-09', totalAmount: 9000, customerCount: 0 },
        { transactionDate: '2026-07-10', totalAmount: 9000, customerCount: 0 },
        { transactionDate: '2026-07-11', totalAmount: 9999, customerCount: 0 },
      ],
      baseline: [
        { transactionDate: '2026-06-08', totalAmount: 6000, customerCount: 0 },
        { transactionDate: '2026-06-09', totalAmount: 6000, customerCount: 0 },
        { transactionDate: '2026-06-10', totalAmount: 6000, customerCount: 0 },
        { transactionDate: '2026-06-11', totalAmount: 12000, customerCount: 0 },
      ],
    });

    expect(result.rows[1]).toMatchObject({
      weekIndex: 2,
      dayStart: 8,
      dayEnd: 14,
      avgDailyCurrent: 9000,
      avgDailyBaseline: 6000,
      deltaPct: 50,
    });
  });

  it('keeps future current weeks without a delta while showing full baseline week average', () => {
    const result = buildDashboardWeeklySalesComparisonRowsFromDaily({
      currentYear: 2026,
      currentMonth: 7,
      baselineYear: 2026,
      baselineMonth: 6,
      currentMaxDayInclusive: 10,
      current: [],
      baseline: [
        { transactionDate: '2026-06-15', totalAmount: 7000, customerCount: 0 },
        { transactionDate: '2026-06-16', totalAmount: 7000, customerCount: 0 },
        { transactionDate: '2026-06-17', totalAmount: 7000, customerCount: 0 },
        { transactionDate: '2026-06-18', totalAmount: 7000, customerCount: 0 },
        { transactionDate: '2026-06-19', totalAmount: 7000, customerCount: 0 },
        { transactionDate: '2026-06-20', totalAmount: 7000, customerCount: 0 },
        { transactionDate: '2026-06-21', totalAmount: 7000, customerCount: 0 },
      ],
    });

    expect(result.rows[2]).toMatchObject({
      weekIndex: 3,
      dayStart: 15,
      dayEnd: 21,
      avgDailyCurrent: null,
      avgDailyBaseline: 7000,
      deltaPct: null,
    });
  });
});
