import type { DashboardSalesMetricWeekdayAverage } from '../../../../../types/api/domains/dashboard';
import { calendarYmd, getDayOfWeek } from './calendarDateUtils';

export type DashboardCalendarLedgerTimelineRow = {
  label: string;
  sales: string | number;
};

export function buildDashboardCalendarLedgerMetrics(input: {
  rows: readonly DashboardCalendarLedgerTimelineRow[];
  year: number;
  month: number;
  lastDay: number;
  /** Days included in averages; dailySales still retains every ledger day for the grid. */
  calendarDayCap: number;
}) {
  const dailySales = new Map<string, number>();
  for (const row of input.rows) {
    const day = Number(row.label);
    if (!Number.isInteger(day) || day < 1 || day > input.lastDay) continue;
    const amount = Number(row.sales || 0);
    dailySales.set(calendarYmd(input.year, input.month, day), Number.isFinite(amount) ? amount : 0);
  }

  const calendarDayCap = Math.max(0, Math.min(input.lastDay, input.calendarDayCap));
  const total = Array.from({ length: calendarDayCap }, (_, index) =>
    dailySales.get(calendarYmd(input.year, input.month, index + 1)) ?? 0,
  ).reduce((sum, amount) => sum + amount, 0);
  const weekdayRows = new Map<number, { totalSales: number; calendarDays: number }>();
  for (let day = 1; day <= calendarDayCap; day += 1) {
    const dow = getDayOfWeek(input.year, input.month, day);
    const current = weekdayRows.get(dow) ?? { totalSales: 0, calendarDays: 0 };
    current.totalSales += dailySales.get(calendarYmd(input.year, input.month, day)) ?? 0;
    current.calendarDays += 1;
    weekdayRows.set(dow, current);
  }

  const weekdaySalesAverages: DashboardSalesMetricWeekdayAverage[] = [...weekdayRows.entries()]
    .map(([dow, row]) => ({
      dow,
      totalSales: row.totalSales,
      calendarDays: row.calendarDays,
      avgDaily: row.calendarDays > 0 ? row.totalSales / row.calendarDays : null,
    }));

  return {
    dailySales,
    salesDailyAvgCalendarPeriod: calendarDayCap > 0 ? total / calendarDayCap : 0,
    weekdaySalesAverages,
  };
}