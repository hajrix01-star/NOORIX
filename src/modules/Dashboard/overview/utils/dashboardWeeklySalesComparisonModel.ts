import type { DashboardSalesMetricWeeklyRow } from '../../../../types/api/domains/dashboard';
import { pctChangeVsBaseline } from './dashboardWeeklySales';

export type DashboardWeeklySalesComparisonRow = {
  weekIndex: number;
  dayStart: number;
  dayEnd: number;
  avgDailyCurrent: number;
  avgDailyBaseline: number;
  deltaPct: number | null;
};

export type DashboardWeeklySalesComparisonData = {
  rows: DashboardWeeklySalesComparisonRow[];
};

export function buildDashboardWeeklySalesComparisonRows(
  current: readonly DashboardSalesMetricWeeklyRow[] | null | undefined,
  baseline: readonly DashboardSalesMetricWeeklyRow[] | null | undefined,
): DashboardWeeklySalesComparisonData {
  const currentRows = Array.isArray(current) ? current : [];
  const baselineRows = Array.isArray(baseline) ? baseline : [];
  const maxRows = Math.max(currentRows.length, baselineRows.length);
  const rows: DashboardWeeklySalesComparisonRow[] = [];

  for (let index = 0; index < maxRows; index += 1) {
    const currentRow = currentRows[index];
    const baselineRow = baselineRows[index];
    const avgDailyCurrent = Number(currentRow?.avgDailyInWeek ?? 0);
    const avgDailyBaseline = Number(baselineRow?.avgDailyInWeek ?? 0);

    rows.push({
      weekIndex: currentRow?.weekIndex ?? baselineRow?.weekIndex ?? index + 1,
      dayStart: currentRow?.dayStart ?? baselineRow?.dayStart ?? 0,
      dayEnd: currentRow?.dayEnd ?? baselineRow?.dayEnd ?? 0,
      avgDailyCurrent,
      avgDailyBaseline,
      deltaPct: pctChangeVsBaseline(avgDailyCurrent, avgDailyBaseline),
    });
  }

  return { rows };
}
