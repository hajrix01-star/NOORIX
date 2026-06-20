import { toYmd } from '../../../../utils/saudiDate';
import type { PlReportLike } from './dashboardOverviewCalculations';
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

type TFn = (key: string) => string;

type SummaryLike = SalesSummaryLike & {
  channels?: Array<{ amount?: string | number | null; vault?: { nameAr?: string | null; nameEn?: string | null } }>;
};

export function buildPerformanceRows(params: {
  report: PlReportLike | null | undefined;
  timelineGrain: string;
  dailySummaries: SummaryLike[];
  lastDayChart: number;
  lang: string;
  t: TFn;
  monthNamesAr: string[];
  enMonths: readonly string[];
}): Record<string, string | number>[] {
  const {
    report,
    timelineGrain,
    dailySummaries,
    lastDayChart,
    lang,
    t,
    monthNamesAr,
    enMonths,
  } = params;

  if (timelineGrain === 'daily') {
    const byDay = new Map<number, number>();
    (dailySummaries || []).forEach((s) => {
      const d = toYmd(s.transactionDate);
      const dayNum = parseInt(d.slice(8, 10), 10);
      byDay.set(dayNum, (byDay.get(dayNum) || 0) + Number(s.totalAmount || 0));
    });
    return Array.from({ length: lastDayChart }, (_, i) => ({
      label: String(i + 1),
      [t('annualSales')]: byDay.get(i + 1) || 0,
    }));
  }

  const sg = report?.groups?.find((r) => r.key === 'sales');
  const pg = report?.groups?.find((r) => r.key === 'purchases');
  const eg = report?.groups?.find((r) => r.key === 'expenses');
  return enMonths.map((lbl, i) => ({
    label: lang === 'ar' ? monthNamesAr[i] : lbl,
    [t('annualSales')]: Number(sg?.months?.[i] || 0),
    [t('annualPurchases')]: Number(pg?.months?.[i] || 0),
    [t('annualExpenses')]: Number(eg?.months?.[i] || 0),
  }));
}

export function buildChannelPieRows(params: {
  yearSummaries: SummaryLike[];
  dailySummaries: SummaryLike[];
  /** شهر محدّد من فلتر الصفحة — يوميات الشهر؛ وإلا ملخصات السنة */
  selectedMonth: number | null;
  lang: string;
}): { name: string; value: number; pct: string }[] {
  const { yearSummaries, dailySummaries, selectedMonth, lang } = params;
  const src =
    selectedMonth != null && selectedMonth >= 1 && selectedMonth <= 12
      ? dailySummaries || []
      : yearSummaries || [];
  const map: Record<string, number> = {};
  src.forEach((s) =>
    (s.channels || []).forEach((ch) => {
      const name =
        lang === 'ar'
          ? ch.vault?.nameAr || ch.vault?.nameEn || '—'
          : ch.vault?.nameEn || ch.vault?.nameAr || '—';
      map[name] = (map[name] || 0) + Number(ch.amount || 0);
    }),
  );
  const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(map)
    .map(([name, value]) => ({ name, value, pct: ((value / total) * 100).toFixed(1) }))
    .sort((a, b) => b.value - a.value);
}

export function buildTopSuppliersChartData(
  periodData: { topSuppliers?: Array<Record<string, unknown>> } | null | undefined,
  lang: string,
  pieColors: readonly string[],
): Array<{
  name: string;
  value: number;
  count: number;
  pct: string;
  fill: string;
}> {
  const list = (periodData?.topSuppliers || []).slice(0, 8);
  const total = list.reduce((s, x) => s + Number((x as { totalAmount?: unknown }).totalAmount || 0), 0) || 1;
  return list.map((s, i) => {
    const row = s as {
      nameAr?: string;
      nameEn?: string;
      totalAmount?: unknown;
      invoiceCount?: number;
    };
    return {
      name: (lang === 'ar' ? row.nameAr || row.nameEn : row.nameEn || row.nameAr) || '—',
      value: Number(row.totalAmount || 0),
      count: row.invoiceCount || 0,
      pct: ((Number(row.totalAmount || 0) / total) * 100).toFixed(1),
      fill: pieColors[i % pieColors.length],
    };
  });
}

export function buildPurchaseCategoriesData(
  periodData: {
    purchaseCategoryBreakdown?: Array<Record<string, unknown>>;
    purchaseCategoryTotal?: unknown;
  } | null | undefined,
  lang: string,
  pieColors: readonly string[],
): { name: string; value: number; pct: string; fill: string }[] {
  const raw = periodData?.purchaseCategoryBreakdown;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const total =
    Number(periodData?.purchaseCategoryTotal) ||
    raw.reduce((s, r) => s + Number((r as { amount?: unknown }).amount || 0), 0) ||
    1;
  return raw.map((row, i) => {
    const r = row as { amount?: unknown; nameAr?: string; nameEn?: string };
    const amt = Number(r.amount || 0);
    return {
      name: lang === 'ar' ? String(r.nameAr) : String(r.nameEn || r.nameAr) || '—',
      value: amt,
      pct: ((amt / total) * 100).toFixed(1),
      fill: pieColors[i % pieColors.length],
    };
  });
}

export function mergePurchaseCategoriesOthers(
  purchaseCategoriesData: { name: string; value: number; pct: string; fill: string }[],
  othersLabel: string,
  pieColors: readonly string[],
): { name: string; value: number; pct: string; fill: string }[] {
  if (purchaseCategoriesData.length === 0) return [];
  if (purchaseCategoriesData.length <= 6) return purchaseCategoriesData;
  const top = purchaseCategoriesData.slice(0, 5);
  const rest = purchaseCategoriesData.slice(5);
  const othersValue = rest.reduce((s, r) => s + r.value, 0);
  const total = purchaseCategoriesData.reduce((s, r) => s + r.value, 0) || 1;
  return [
    ...top,
    {
      name: othersLabel,
      value: othersValue,
      pct: ((othersValue / total) * 100).toFixed(1),
      fill: pieColors[5 % pieColors.length],
    },
  ];
}

export type RevenueDailyAvgCompareTone = 'up' | 'down' | 'neutral';

/** Compare current-month daily avg to previous month (revenue: higher is better → up). */
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

/**
 * Monthly daily revenue averages for a calendar year, Jan → capMonth.
 * Always: sum ÷ calendar days in the period (full month, MTD, or aligned slice).
 */
export function buildYearMonthlyDailyAvgRows(params: {
  year: number;
  yearSummaries: SummaryLike[] | null | undefined;
  monthNames: readonly string[];
  capMonth: number;
  currentYear: number;
  currentMonth: number;
  currentDay: number;
  /**
   * When viewing the current month (MTD), cap the prior month row to the same
   * calendar day so it matches the revenue card «الشهر الماضي» comparison.
   */
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

  for (const s of yearSummaries ?? []) {
    const ymdStr = toYmd(s.transactionDate);
    if (!ymdStr || ymdStr.length < 7 || !ymdStr.startsWith(prefix)) continue;
    const month = parseInt(ymdStr.slice(5, 7), 10);
    if (!Number.isFinite(month) || month < 1 || month > capMonth) continue;
    if (!byMonthDay.has(month)) byMonthDay.set(month, new Map());
    const dayMap = byMonthDay.get(month)!;
    dayMap.set(ymdStr, (dayMap.get(ymdStr) || 0) + Number(s.totalAmount || 0));
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
      for (const [ymdStr, amt] of dayMap.entries()) {
        const day = parseInt(ymdStr.slice(8, 10), 10);
        if (!Number.isFinite(day) || day < 1 || day > maxDayInclusive) continue;
        sum += amt;
      }
    }

    const calendarDaysInPeriod = maxDayInclusive;
    const avgDaily = dailyAvgFromTotal(sum, calendarDaysInPeriod);
    const deltaPctVsPrev =
      avgDaily != null && prevAvg != null ? revenueDailyAvgDeltaPct(avgDaily, prevAvg) : null;

    rows.push({
      month,
      monthLabel: monthNames[month - 1] ?? String(month),
      totalSales: sum > 0 ? sum : null,
      avgDaily,
      calendarDays: calendarDaysInPeriod,
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
  performanceData: Record<string, string | number>[],
  salesKey: string,
): number {
  return performanceData.reduce((s, p) => s + Number(p[salesKey] || 0), 0);
}
