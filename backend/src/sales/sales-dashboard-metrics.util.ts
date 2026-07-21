import { toYmd } from '../common/utils/to-ymd.util';
import { nowSaudi } from '../common/utils/date-utils';

export type DashboardDailyMetricRow = {
  transactionDate: string;
  shift: string;
  totalAmount: string;
  customerCount: number;
};

export type DashboardDailyTotalMetricRow = {
  transactionDate: string;
  totalAmount: number;
  customerCount: number;
};

export type DashboardSalesShiftBucket = {
  amount: number;
  customers: number;
  sharePct: number | null;
};

export type DashboardChannelMetricRow = {
  periodKey: string;
  vaultId: string;
  nameAr: string;
  nameEn: string | null;
  type: string | null;
  amount: string;
};

export type DashboardChannelBreakdownMetricRow = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  amount: number;
  sharePct: number | null;
};

function ymdParts(value: string): { year: number; month: number; day: number } | null {
  const ymd = toYmd(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  const day = Number(ymd.slice(8, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return { year, month, day };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function periodDailyAverage(rows: readonly DashboardDailyMetricRow[], endDayInclusive?: number) {
  if (!rows.length) return { total: 0, customerCount: 0, calendarDays: 0, revenueAvgDaily: null, customerAvgDaily: null };
  const first = ymdParts(rows[0].transactionDate);
  if (!first) return { total: 0, customerCount: 0, calendarDays: 0, revenueAvgDaily: null, customerAvgDaily: null };
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

function monthKeysInRange(startDate: string, endDate: string): Array<{ year: number; month: number; periodKey: string }> {
  const start = ymdParts(startDate);
  const end = ymdParts(endDate);
  if (!start || !end) return [];
  const out: Array<{ year: number; month: number; periodKey: string }> = [];
  for (let year = start.year; year <= end.year; year += 1) {
    const fromMonth = year === start.year ? start.month : 1;
    const toMonth = year === end.year ? end.month : 12;
    for (let month = fromMonth; month <= toMonth; month += 1) {
      out.push({ year, month, periodKey: `${year}-${String(month).padStart(2, '0')}` });
    }
  }
  return out;
}

export function appSalesModel(
  yearStart: string,
  yearEnd: string,
  dailyRows: readonly DashboardDailyMetricRow[],
  channelRows: readonly DashboardChannelMetricRow[],
) {
  const monthKeys = monthKeysInRange(yearStart, yearEnd);
  const totals = new Map<string, number>();
  const apps = new Map<string, number>();
  const channels = new Map<
    string,
    {
      id: string;
      nameAr: string;
      nameEn: string | null;
      periodAmount: number;
      months: Record<string, { amount: number; percent: number }>;
    }
  >();

  for (const key of monthKeys) {
    totals.set(key.periodKey, 0);
    apps.set(key.periodKey, 0);
  }

  for (const row of dailyRows) {
    const parts = ymdParts(row.transactionDate);
    if (!parts) continue;
    const periodKey = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
    if (!totals.has(periodKey)) continue;
    totals.set(periodKey, (totals.get(periodKey) ?? 0) + Number(row.totalAmount || 0));
  }

  for (const row of channelRows) {
    if (!totals.has(row.periodKey) || row.type !== 'app') continue;
    const amount = Number(row.amount || 0);
    if (!Number.isFinite(amount) || amount === 0) continue;
    apps.set(row.periodKey, (apps.get(row.periodKey) ?? 0) + amount);
    const existing = channels.get(row.vaultId) ?? {
      id: row.vaultId,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      periodAmount: 0,
      months: {},
    };
    existing.periodAmount += amount;
    existing.months[row.periodKey] = {
      amount: (existing.months[row.periodKey]?.amount ?? 0) + amount,
      percent: 0,
    };
    channels.set(row.vaultId, existing);
  }

  const monthSeries = monthKeys.map((key) => {
    const total = totals.get(key.periodKey) ?? 0;
    const app = apps.get(key.periodKey) ?? 0;
    return {
      ...key,
      total,
      app,
      appPercent: total > 0 ? (app / total) * 100 : 0,
    };
  });

  const periodTotal = monthSeries.reduce((sum, row) => sum + row.total, 0);
  const periodApp = monthSeries.reduce((sum, row) => sum + row.app, 0);

  const channelRowsOut = Array.from(channels.values())
    .map((row) => {
      const months: Record<string, { amount: number; percent: number }> = {};
      for (const key of monthKeys) {
        const amount = row.months[key.periodKey]?.amount ?? 0;
        const monthTotal = totals.get(key.periodKey) ?? 0;
        months[key.periodKey] = {
          amount,
          percent: monthTotal > 0 ? (amount / monthTotal) * 100 : 0,
        };
      }
      return {
        id: row.id,
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        periodAmount: row.periodAmount,
        periodPercent: periodTotal > 0 ? (row.periodAmount / periodTotal) * 100 : 0,
        months,
      };
    })
    .filter((row) => row.periodAmount > 0)
    .sort((a, b) => b.periodAmount - a.periodAmount);

  return {
    monthSeries,
    channels: channelRowsOut,
    periodTotal,
    periodApp,
    periodAppPercent: periodTotal > 0 ? (periodApp / periodTotal) * 100 : 0,
    hasData: periodTotal > 0,
  };
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

  const sumRange = (
    rows: readonly DashboardDailyMetricRow[],
    year: number,
    month: number,
    startDay: number,
    endDay: number,
  ) => {
    let total = 0;
    for (const row of rows) {
      const parts = ymdParts(row.transactionDate);
      if (!parts || parts.year !== year || parts.month !== month || parts.day < startDay || parts.day > endDay) continue;
      total += Number(row.totalAmount || 0);
    }
    return total;
  };

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
