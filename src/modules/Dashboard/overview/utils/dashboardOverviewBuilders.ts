import { toYmd } from '../../../../utils/saudiDate';
import {
  dailyAvgFromTotal,
  resolveYearlyMonthEndDay,
  type SalesSummaryLike,
} from './dashboardDailyAvg';

export type { SalesSummaryLike } from './dashboardDailyAvg';
export {
  computeCustomerDailyAvgActiveDays,
  computeCustomerMonthDailyAvg,
  computeDailyAvgForCalendarPeriod,
  computeMonthMetricDailyAvg,
  computeRevenueDailyAvgActiveDays,
  computeRevenueMonthDailyAvg,
  computeSliceDailyAvg,
  countRevenueActiveSalesDays,
  dailyAvgFromTotal,
  filterSalesThroughDay,
  lastRevenueSalesDayInMonth,
  pickCustomers,
  pickRevenue,
  resolvePeriodEndDay,
  resolveYearlyMonthEndDay,
  revenueMtdEndDay,
  sumCustomersThroughDay,
  sumRevenueThroughDay,
} from './dashboardDailyAvg';

export type DashboardPerformanceRow = Record<string, string | number>;

export function buildChannelBreakdownRowsFromBackend(params: {
  rows: readonly {
    nameAr?: string | null;
    nameEn?: string | null;
    amount?: string | number | null;
    sharePct?: number | null;
  }[] | null | undefined;
  lang: string;
}): { name: string; value: number; pct: string }[] {
  return (params.rows ?? []).map((row) => ({
    name: (params.lang === 'ar' ? row.nameAr || row.nameEn : row.nameEn || row.nameAr) || '-',
    value: Number(row.amount || 0),
    pct: row.sharePct != null ? row.sharePct.toFixed(1) : '0',
  }));
}

export function buildTopSuppliersChartRowsFromBackend(
  periodData: {
    topSuppliers?: Array<{
      nameAr?: string | null;
      nameEn?: string | null;
      totalAmount?: string | number | null;
      invoiceCount?: number | null;
      sharePct?: number | null;
    }>;
  } | null | undefined,
  lang: string,
  pieColors: readonly string[],
): Array<{
  name: string;
  value: number;
  count: number;
  pct: string;
  fill: string;
}> {
  return (periodData?.topSuppliers ?? []).slice(0, 8).map((row, index) => ({
    name: (lang === 'ar' ? row.nameAr || row.nameEn : row.nameEn || row.nameAr) || '-',
    value: Number(row.totalAmount || 0),
    count: row.invoiceCount || 0,
    pct: row.sharePct != null ? row.sharePct.toFixed(1) : '0',
    fill: pieColors[index % pieColors.length],
  }));
}

export function buildPurchaseCategoriesRowsFromBackend(
  periodData: {
    purchaseCategoryBreakdown?: Array<{
      nameAr?: string | null;
      nameEn?: string | null;
      amount?: string | number | null;
      sharePct?: number | null;
    }>;
  } | null | undefined,
  lang: string,
  pieColors: readonly string[],
): { name: string; value: number; pct: string; fill: string }[] {
  return (periodData?.purchaseCategoryBreakdown ?? []).map((row, index) => ({
    name: (lang === 'ar' ? row.nameAr || row.nameEn : row.nameEn || row.nameAr) || '-',
    value: Number(row.amount || 0),
    pct: row.sharePct != null ? row.sharePct.toFixed(1) : '0',
    fill: pieColors[index % pieColors.length],
  }));
}

export type RevenueDailyAvgCompareTone = 'up' | 'down' | 'neutral';

export function compareRevenueDailyAvgTone(
  current: number | null | undefined,
  prev: number | null | undefined,
): RevenueDailyAvgCompareTone {
  if (current == null || prev == null) return 'neutral';
  if (current > prev) return 'up';
  if (current < prev) return 'down';
  return 'neutral';
}

export function revenueDailyAvgDeltaPct(current: number, prev: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(prev) || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

export type YearMonthlyDailyAvgRow = {
  month: number;
  monthLabel: string;
  totalSales: number | null;
  avgDaily: number | null;
  calendarDays: number;
  deltaPctVsPrev: number | null;
  tone: RevenueDailyAvgCompareTone;
  isCurrentMonth: boolean;
};

export type BackendYearMonthlyDailyAvgRow = {
  month: number;
  totalSales: number | null;
  avgDaily: number | null;
  calendarDays: number;
  deltaPctVsPrev: number | null;
  tone: RevenueDailyAvgCompareTone;
  isCurrentMonth: boolean;
};

export function buildYearMonthlyDailyAvgRowsFromBackend(params: {
  rows: readonly BackendYearMonthlyDailyAvgRow[] | null | undefined;
  monthNames: readonly string[];
  capMonth: number;
  currentYear: number;
  currentMonth: number;
  year: number;
}): YearMonthlyDailyAvgRow[] {
  const { rows, monthNames, capMonth, currentYear, currentMonth, year } = params;
  if (capMonth <= 0) return [];

  const byMonth = new Map<number, BackendYearMonthlyDailyAvgRow>();
  for (const row of rows ?? []) {
    if (!Number.isInteger(row.month) || row.month < 1 || row.month > 12) continue;
    byMonth.set(row.month, row);
  }

  return Array.from({ length: capMonth }, (_, index) => {
    const month = index + 1;
    const source = byMonth.get(month);
    return {
      month,
      monthLabel: monthNames[index] ?? String(month),
      totalSales: source?.totalSales ?? null,
      avgDaily: source?.avgDaily ?? null,
      calendarDays: source?.calendarDays ?? 0,
      deltaPctVsPrev: source?.deltaPctVsPrev ?? null,
      tone: source?.tone ?? 'neutral',
      isCurrentMonth: source?.isCurrentMonth ?? (year === currentYear && month === currentMonth),
    };
  });
}

export function buildYearMonthlyDailyAvgRows(params: {
  year: number;
  yearSummaries: SalesSummaryLike[] | null | undefined;
  monthNames: readonly string[];
  capMonth: number;
  currentYear: number;
  currentMonth: number;
  currentDay: number;
  prevMonthAlignEndDay?: number;
}): YearMonthlyDailyAvgRow[] {
  const {
    year,
    yearSummaries,
    monthNames,
    capMonth,
    currentYear,
    currentMonth,
    currentDay,
    prevMonthAlignEndDay,
  } = params;
  if (capMonth <= 0) return [];

  const prefix = `${year}-`;
  const byMonthDay = new Map<number, Map<string, number>>();

  for (const summary of yearSummaries ?? []) {
    const ymd = toYmd(summary.transactionDate);
    if (!ymd || ymd.length < 7 || !ymd.startsWith(prefix)) continue;
    const month = parseInt(ymd.slice(5, 7), 10);
    if (!Number.isFinite(month) || month < 1 || month > capMonth) continue;
    if (!byMonthDay.has(month)) byMonthDay.set(month, new Map());
    const dayMap = byMonthDay.get(month);
    dayMap?.set(ymd, (dayMap.get(ymd) || 0) + Number(summary.totalAmount || 0));
  }

  const rows: YearMonthlyDailyAvgRow[] = [];
  let prevAvg: number | null = null;

  for (let month = 1; month <= capMonth; month += 1) {
    const dayMap = byMonthDay.get(month);
    const maxDayInclusive = resolveYearlyMonthEndDay({
      year,
      month,
      capMonth,
      currentYear,
      currentMonth,
      currentDay,
      prevMonthAlignEndDay,
    });

    let sum = 0;
    if (dayMap) {
      for (const [ymd, amount] of dayMap.entries()) {
        const day = parseInt(ymd.slice(8, 10), 10);
        if (!Number.isFinite(day) || day < 1 || day > maxDayInclusive) continue;
        sum += amount;
      }
    }

    const avgDaily = dailyAvgFromTotal(sum, maxDayInclusive);
    const deltaPctVsPrev =
      avgDaily != null && prevAvg != null ? revenueDailyAvgDeltaPct(avgDaily, prevAvg) : null;

    rows.push({
      month,
      monthLabel: monthNames[month - 1] ?? String(month),
      totalSales: sum > 0 ? sum : null,
      avgDaily,
      calendarDays: maxDayInclusive,
      deltaPctVsPrev,
      tone: compareRevenueDailyAvgTone(avgDaily, prevAvg),
      isCurrentMonth: year === currentYear && month === currentMonth,
    });

    if (avgDaily != null) prevAvg = avgDaily;
  }

  return rows;
}

export function yearMonthlyDailyAvgCapMonth(
  year: number,
  currentYear: number,
  currentMonth: number,
): number {
  if (year < currentYear) return 12;
  if (year > currentYear) return 0;
  return currentMonth;
}

export function performanceTotalForSalesKey(
  performanceData: DashboardPerformanceRow[],
  salesKey: string,
): number {
  return performanceData.reduce((sum, row) => sum + Number(row[salesKey] || 0), 0);
}
