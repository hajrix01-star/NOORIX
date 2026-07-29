import { lastDayOfMonth, ymdParts } from './sales-dashboard-metrics.dates';
import { selectedMonthAverageEndDay } from './sales-dashboard-daily-metrics.util';
import type { DashboardDailyMetricRow } from './sales-dashboard-metrics.types';

export function weeklyRows(rows: readonly DashboardDailyMetricRow[]) {
  if (!rows.length) return [];
  const first = ymdParts(rows[0].transactionDate);
  if (!first) return [];
  const ld = lastDayOfMonth(first.year, first.month);
  const byDay = new Map<number, { total: number; customers: number }>();
  for (const row of rows) {
    const parts = ymdParts(row.transactionDate);
    if (!parts || parts.year !== first.year || parts.month !== first.month) continue;
    const prev = byDay.get(parts.day) ?? { total: 0, customers: 0 };
    prev.total += Number(row.totalAmount || 0);
    prev.customers += row.customerCount || 0;
    byDay.set(parts.day, prev);
  }
  const out: Array<{
    weekIndex: number;
    dayStart: number;
    dayEnd: number;
    totalSales: number;
    avgDailyInWeek: number;
    calendarDaysInSlice: number;
  }> = [];
  let dayStart = 1;
  let weekIndex = 1;
  while (dayStart <= ld) {
    const dayEnd = Math.min(dayStart + 6, ld);
    let totalSales = 0;
    for (let day = dayStart; day <= dayEnd; day += 1) {
      totalSales += byDay.get(day)?.total ?? 0;
    }
    const calendarDaysInSlice = dayEnd - dayStart + 1;
    out.push({
      weekIndex,
      dayStart,
      dayEnd,
      totalSales,
      avgDailyInWeek: calendarDaysInSlice > 0 ? totalSales / calendarDaysInSlice : 0,
      calendarDaysInSlice,
    });
    dayStart = dayEnd + 1;
    weekIndex += 1;
  }
  return out;
}

function pctChange(current: number | null, baseline: number): number | null {
  if (current == null || !Number.isFinite(current) || !Number.isFinite(baseline) || Math.abs(baseline) <= 1e-9) {
    return null;
  }
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

function sumRange(
  rows: readonly DashboardDailyMetricRow[],
  year: number,
  month: number,
  startDay: number,
  endDay: number,
): number {
  let total = 0;
  for (const row of rows) {
    const parts = ymdParts(row.transactionDate);
    if (!parts || parts.year !== year || parts.month !== month || parts.day < startDay || parts.day > endDay) continue;
    total += Number(row.totalAmount || 0);
  }
  return total;
}

export function weeklyComparisonRows(
  currentRows: readonly DashboardDailyMetricRow[],
  baselineRows: readonly DashboardDailyMetricRow[],
) {
  if (!currentRows.length && !baselineRows.length) return [];
  const currentFirst = currentRows[0] ? ymdParts(currentRows[0].transactionDate) : null;
  const baselineFirst = baselineRows[0] ? ymdParts(baselineRows[0].transactionDate) : null;
  if (!currentFirst || !baselineFirst) return [];

  const currentLastDay = lastDayOfMonth(currentFirst.year, currentFirst.month);
  const baselineLastDay = lastDayOfMonth(baselineFirst.year, baselineFirst.month);
  const currentCap = selectedMonthAverageEndDay(currentRows) ?? currentLastDay;
  const maxWeeks = Math.max(Math.ceil(currentLastDay / 7), Math.ceil(baselineLastDay / 7));

  return Array.from({ length: maxWeeks }, (_, index) => {
    const dayStart = index * 7 + 1;
    const currentWeekEnd = Math.min(dayStart + 6, currentLastDay);
    const baselineWeekEnd = Math.min(dayStart + 6, baselineLastDay);
    const hasCurrentWeekStarted = currentCap >= dayStart;
    const currentEffectiveEnd = hasCurrentWeekStarted ? Math.min(currentWeekEnd, currentCap) : dayStart - 1;
    const currentDays = hasCurrentWeekStarted ? currentEffectiveEnd - dayStart + 1 : 0;
    const baselineEffectiveEnd =
      currentDays > 0
        ? Math.min(baselineWeekEnd, dayStart + currentDays - 1)
        : baselineWeekEnd;
    const baselineDays = Math.max(0, baselineEffectiveEnd - dayStart + 1);
    const currentTotal =
      currentDays > 0
        ? sumRange(currentRows, currentFirst.year, currentFirst.month, dayStart, currentEffectiveEnd)
        : 0;
    const baselineTotal =
      baselineDays > 0
        ? sumRange(baselineRows, baselineFirst.year, baselineFirst.month, dayStart, baselineEffectiveEnd)
        : 0;
    const avgDailyCurrent = currentDays > 0 ? currentTotal / currentDays : null;
    const avgDailyBaseline = baselineDays > 0 ? baselineTotal / baselineDays : 0;
    return {
      weekIndex: index + 1,
      dayStart,
      dayEnd: currentWeekEnd,
      avgDailyCurrent,
      avgDailyBaseline,
      deltaPct: pctChange(avgDailyCurrent, avgDailyBaseline),
    };
  });
}
