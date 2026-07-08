import { describe, expect, it } from 'vitest';
import { buildDashboardWeeklySalesComparisonRows } from './dashboardWeeklySalesComparisonModel';

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
});
