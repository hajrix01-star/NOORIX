import type { DashboardSalesMetricDay, DashboardSalesMetricWeeklyRow } from '../../../../types/api/domains/dashboard';
import { pctChangeVsBaseline } from './dashboardWeeklySales';
import { toYmd } from '../../../../utils/saudiDate';
import { computeSliceDailyAvg } from './dashboardDailyAvg';
import { lastDayOfMonth } from './dashboardOverviewDateUtils';

export type DashboardWeeklySalesComparisonRow = {
  weekIndex: number;
  dayStart: number;
  dayEnd: number;
  avgDailyCurrent: number | null;
  avgDailyBaseline: number;
  deltaPct: number | null;
};

export type DashboardWeeklySalesComparisonData = {
  rows: DashboardWeeklySalesComparisonRow[];
};

function sumMetricDays(
  rows: readonly DashboardSalesMetricDay[],
  year: number,
  month: number,
  dayStart: number,
  dayEnd: number,
): number {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  let total = 0;
  for (const row of rows) {
    const date = toYmd(row.transactionDate);
    if (!date?.startsWith(prefix)) continue;
    const day = Number(date.slice(8, 10));
    if (!Number.isFinite(day) || day < dayStart || day > dayEnd) continue;
    total += Number(row.totalAmount || 0);
  }
  return total;
}

export function buildDashboardWeeklySalesComparisonRowsFromDaily(params: {
  current: readonly DashboardSalesMetricDay[] | null | undefined;
  baseline: readonly DashboardSalesMetricDay[] | null | undefined;
  currentYear: number;
  currentMonth: number;
  baselineYear: number;
  baselineMonth: number;
  currentMaxDayInclusive?: number;
}): DashboardWeeklySalesComparisonData {
  const currentRows = Array.isArray(params.current) ? params.current : [];
  const baselineRows = Array.isArray(params.baseline) ? params.baseline : [];
  const currentLastDay = lastDayOfMonth(params.currentYear, params.currentMonth);
  const baselineLastDay = lastDayOfMonth(params.baselineYear, params.baselineMonth);
  const maxWeeks = Math.max(Math.ceil(currentLastDay / 7), Math.ceil(baselineLastDay / 7));
  const cap =
    params.currentMaxDayInclusive != null
      ? Math.max(0, Math.min(params.currentMaxDayInclusive, currentLastDay))
      : currentLastDay;
  const rows: DashboardWeeklySalesComparisonRow[] = [];

  for (let index = 0; index < maxWeeks; index += 1) {
    const dayStart = index * 7 + 1;
    const currentWeekEnd = Math.min(dayStart + 6, currentLastDay);
    const baselineWeekEnd = Math.min(dayStart + 6, baselineLastDay);
    const hasCurrentWeekStarted = cap >= dayStart;
    const currentEffectiveEnd = hasCurrentWeekStarted ? Math.min(currentWeekEnd, cap) : dayStart - 1;
    const currentDays = hasCurrentWeekStarted ? currentEffectiveEnd - dayStart + 1 : 0;
    const baselineEffectiveEnd =
      currentDays > 0
        ? Math.min(baselineWeekEnd, dayStart + currentDays - 1)
        : baselineWeekEnd;
    const baselineDays = Math.max(0, baselineEffectiveEnd - dayStart + 1);
    const currentTotal =
      currentDays > 0
        ? sumMetricDays(currentRows, params.currentYear, params.currentMonth, dayStart, currentEffectiveEnd)
        : 0;
    const baselineTotal =
      baselineDays > 0
        ? sumMetricDays(baselineRows, params.baselineYear, params.baselineMonth, dayStart, baselineEffectiveEnd)
        : 0;
    const avgDailyCurrent = currentDays > 0 ? computeSliceDailyAvg(currentTotal, currentDays) : null;
    const avgDailyBaseline = computeSliceDailyAvg(baselineTotal, baselineDays);

    rows.push({
      weekIndex: index + 1,
      dayStart,
      dayEnd: currentWeekEnd,
      avgDailyCurrent,
      avgDailyBaseline,
      deltaPct: avgDailyCurrent != null ? pctChangeVsBaseline(avgDailyCurrent, avgDailyBaseline) : null,
    });
  }

  return { rows };
}

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
