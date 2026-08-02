import { nowSaudi } from '../common/utils/date-utils';
import { lastDayOfMonth, ymdParts } from './sales-dashboard-metrics.dates';
import type {
  DashboardChannelBreakdownMetricRow,
  DashboardChannelMetricRow,
  DashboardDailyMetricRow,
  DashboardDailyTotalMetricRow,
  DashboardSalesShiftBucket,
  DashboardWeekdayAverageMetricRow,
} from './sales-dashboard-metrics.types';

export function periodDailyAverage(rows: readonly DashboardDailyMetricRow[], endDayInclusive?: number) {
  if (!rows.length) return { total: 0, customerCount: 0, calendarDays: 0, revenueAvgDaily: null, customerAvgDaily: null, basketAvg: null };
  const first = ymdParts(rows[0].transactionDate);
  if (!first) return { total: 0, customerCount: 0, calendarDays: 0, revenueAvgDaily: null, customerAvgDaily: null, basketAvg: null };
  const cap = Math.max(0, Math.min(endDayInclusive ?? lastDayOfMonth(first.year, first.month), lastDayOfMonth(first.year, first.month)));
  let total = 0;
  let customerCount = 0;
  for (const row of rows) {
    const parts = ymdParts(row.transactionDate);
    if (!parts || parts.year !== first.year || parts.month !== first.month || parts.day > cap) continue;
    total += Number(row.totalAmount || 0);
    customerCount += row.customerCount || 0;
  }
  return {
    total,
    customerCount,
    calendarDays: cap,
    revenueAvgDaily: cap > 0 ? total / cap : null,
    customerAvgDaily: cap > 0 ? customerCount / cap : null,
    basketAvg: customerCount > 0 ? total / customerCount : null,
  };
}

function lastEnteredSalesDay(rows: readonly DashboardDailyMetricRow[], year: number, month: number): number {
  let last = 0;
  for (const row of rows) {
    const parts = ymdParts(row.transactionDate);
    if (!parts || parts.year !== year || parts.month !== month) continue;
    if (parts.day > last) last = parts.day;
  }
  return last;
}

export function selectedMonthAverageEndDay(rows: readonly DashboardDailyMetricRow[]): number | undefined {
  if (!rows.length) return undefined;
  const first = ymdParts(rows[0].transactionDate);
  if (!first) return undefined;
  const saudiNow = nowSaudi();
  const currentYear = saudiNow.getFullYear();
  const currentMonth = saudiNow.getMonth() + 1;
  if (first.year !== currentYear || first.month !== currentMonth) return undefined;
  const lastEnteredDay = lastEnteredSalesDay(rows, first.year, first.month);
  return Math.min(saudiNow.getDate(), lastEnteredDay || saudiNow.getDate());
}

export function dailyTotalRows(rows: readonly DashboardDailyMetricRow[]): DashboardDailyTotalMetricRow[] {
  const totals = new Map<string, DashboardDailyTotalMetricRow>();
  for (const row of rows) {
    const current = totals.get(row.transactionDate) ?? {
      transactionDate: row.transactionDate,
      totalAmount: 0,
      customerCount: 0,
    };
    current.totalAmount += Number(row.totalAmount || 0);
    current.customerCount += row.customerCount || 0;
    totals.set(row.transactionDate, current);
  }
  return [...totals.values()].sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
}

/**
 * Official sales average for each weekday in a calendar-month period.
 * The denominator includes every elapsed calendar occurrence of that weekday,
 * including elapsed days without sales, and shares the same end-day cap as the
 * dashboard monthly daily average.
 */
export function weekdayAverageRows(
  rows: readonly DashboardDailyMetricRow[],
  endDayInclusive?: number,
): DashboardWeekdayAverageMetricRow[] {
  if (!rows.length) return [];
  const first = ymdParts(rows[0].transactionDate);
  if (!first) return [];

  const cap = Math.max(
    0,
    Math.min(endDayInclusive ?? lastDayOfMonth(first.year, first.month), lastDayOfMonth(first.year, first.month)),
  );
  if (cap <= 0) return [];

  const totals = Array<number>(7).fill(0);
  const calendarDays = Array<number>(7).fill(0);

  for (let day = 1; day <= cap; day += 1) {
    const dow = new Date(Date.UTC(first.year, first.month - 1, day)).getUTCDay();
    calendarDays[dow] += 1;
  }

  for (const row of rows) {
    const parts = ymdParts(row.transactionDate);
    if (
      !parts ||
      parts.year !== first.year ||
      parts.month !== first.month ||
      parts.day > cap
    ) {
      continue;
    }
    const dow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
    totals[dow] += Number(row.totalAmount || 0);
  }

  return Array.from({ length: 7 }, (_, dow) => ({
    dow,
    totalSales: totals[dow],
    calendarDays: calendarDays[dow],
    avgDaily: calendarDays[dow] > 0 ? totals[dow] / calendarDays[dow] : null,
  }));
}

export function channelBreakdown(rows: readonly DashboardChannelMetricRow[]): DashboardChannelBreakdownMetricRow[] {
  const byVault = new Map<string, { id: string; nameAr: string; nameEn: string | null; amount: number }>();
  for (const row of rows) {
    const current = byVault.get(row.vaultId) ?? {
      id: row.vaultId,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      amount: 0,
    };
    current.amount += Number(row.amount || 0);
    byVault.set(row.vaultId, current);
  }
  const total = [...byVault.values()].reduce((sum, row) => sum + row.amount, 0);
  return [...byVault.values()]
    .map((row) => ({
      ...row,
      sharePct: total > 0 && row.amount > 0 ? (row.amount / total) * 100 : null,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function salesShiftTotals(rows: readonly DashboardDailyMetricRow[]): Record<'all' | 'morning' | 'evening', DashboardSalesShiftBucket> {
  const out: Record<'all' | 'morning' | 'evening', DashboardSalesShiftBucket> = {
    all: { amount: 0, customers: 0, sharePct: null },
    morning: { amount: 0, customers: 0, sharePct: null },
    evening: { amount: 0, customers: 0, sharePct: null },
  };
  for (const row of rows) {
    const shift = row.shift === 'morning' || row.shift === 'evening' ? row.shift : 'all';
    out[shift].amount += Number(row.totalAmount || 0);
    out[shift].customers += row.customerCount || 0;
  }
  const total = out.all.amount + out.morning.amount + out.evening.amount;
  for (const key of ['all', 'morning', 'evening'] as const) {
    out[key].sharePct = total > 0 && out[key].amount > 0 ? (out[key].amount / total) * 100 : null;
  }
  return out;
}
