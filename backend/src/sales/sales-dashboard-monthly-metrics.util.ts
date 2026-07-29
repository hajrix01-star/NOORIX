import { nowSaudi } from '../common/utils/date-utils';
import { periodDailyAverage, selectedMonthAverageEndDay } from './sales-dashboard-daily-metrics.util';
import { ymdParts } from './sales-dashboard-metrics.dates';
import type { DashboardDailyMetricRow } from './sales-dashboard-metrics.types';

export function monthlyDailyAverages(rows: readonly DashboardDailyMetricRow[]) {
  const saudiNow = nowSaudi();
  const currentYear = saudiNow.getFullYear();
  const currentMonth = saudiNow.getMonth() + 1;
  const byMonth = new Map<string, DashboardDailyMetricRow[]>();
  for (const row of rows) {
    const parts = ymdParts(row.transactionDate);
    if (!parts) continue;
    const key = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
    byMonth.set(key, [...(byMonth.get(key) ?? []), row]);
  }
  let previousAvg: number | null = null;
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodKey, monthRows]) => {
      const first = ymdParts(`${periodKey}-01`);
      const endDay =
        first && first.year === currentYear && first.month === currentMonth
          ? selectedMonthAverageEndDay(monthRows)
          : undefined;
      const avg = periodDailyAverage(monthRows, endDay);
      const deltaPctVsPrev =
        avg.revenueAvgDaily != null && previousAvg != null && Math.abs(previousAvg) > 1e-9
          ? ((avg.revenueAvgDaily - previousAvg) / Math.abs(previousAvg)) * 100
          : null;
      const tone =
        avg.revenueAvgDaily == null || previousAvg == null
          ? 'neutral'
          : avg.revenueAvgDaily > previousAvg
            ? 'up'
            : avg.revenueAvgDaily < previousAvg
              ? 'down'
              : 'neutral';
      if (avg.revenueAvgDaily != null) previousAvg = avg.revenueAvgDaily;
      return {
        periodKey,
        month: first?.month ?? 0,
        totalSales: avg.total > 0 ? avg.total : null,
        avgDaily: avg.revenueAvgDaily,
        calendarDays: avg.calendarDays,
        deltaPctVsPrev,
        tone,
        isCurrentMonth: first?.year === currentYear && first.month === currentMonth,
      };
    });
}
