/**
 * مصدر واحد لحساب المعدل اليومي في لوحة التحكم.
 * القاعدة: المجموع ÷ أيام التقويم في الفترة (شاملة الأيام بدون مبيعات).
 */
import { toYmd } from '../../../../utils/saudiDate';
import { lastDayOfMonth, mtdCalendarDaysInMonth } from './dashboardOverviewDateUtils';

export type SalesSummaryLike = {
  transactionDate?: string | null;
  totalAmount?: string | number | null;
  customerCount?: number | null;
};

export type MonthDailyAvgResult = {
  total: number;
  calendarDays: number;
  endDayInclusive: number;
  avgDaily: number | null;
};

export const pickRevenue = (s: SalesSummaryLike): number => Number(s.totalAmount || 0);
export const pickCustomers = (s: SalesSummaryLike): number => Number(s.customerCount || 0);

/** المجموع ÷ أيام التقويم — null عند عدم وجود بيانات. */
export function dailyAvgFromTotal(total: number, calendarDays: number): number | null {
  if (calendarDays <= 0 || total <= 0) return null;
  return total / calendarDays;
}

/** @deprecated استخدم dailyAvgFromTotal — الاسم القديم للتوافق. */
export const computeDailyAvgForCalendarPeriod = dailyAvgFromTotal;

/** متوسط شريحة (أسبوع): 0 بدل null عند الفراغ — للجداول. */
export function computeSliceDailyAvg(total: number, calendarDaysInSlice: number): number {
  return dailyAvgFromTotal(total, calendarDaysInSlice) ?? 0;
}

export function filterSalesThroughDay(
  monthSales: SalesSummaryLike[] | null | undefined,
  year: number,
  month: number,
  endDayInclusive: number,
): SalesSummaryLike[] {
  const last = lastDayOfMonth(year, month);
  const cap = Math.max(1, Math.min(endDayInclusive, last));
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return (monthSales ?? []).filter((s) => {
    const d = toYmd(s.transactionDate);
    if (!d || !d.startsWith(prefix)) return false;
    const day = parseInt(d.slice(8, 10), 10);
    return Number.isFinite(day) && day >= 1 && day <= cap;
  });
}

export function sumMonthMetric(
  monthSales: SalesSummaryLike[] | null | undefined,
  year: number,
  month: number,
  pick: (s: SalesSummaryLike) => number,
  endDayInclusive?: number,
): number {
  const rows =
    endDayInclusive != null
      ? filterSalesThroughDay(monthSales, year, month, endDayInclusive)
      : (monthSales ?? []).filter((s) => {
          const d = toYmd(s.transactionDate);
          return !!d && d.startsWith(`${year}-${String(month).padStart(2, '0')}-`);
        });
  let total = 0;
  for (const s of rows) {
    total += pick(s);
  }
  return total;
}

export function lastMetricDayInMonth(
  monthSales: SalesSummaryLike[] | null | undefined,
  year: number,
  month: number,
  pickMetric: (s: SalesSummaryLike) => number,
): number {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  let maxDay = 0;
  for (const s of monthSales ?? []) {
    const d = toYmd(s.transactionDate);
    if (!d?.startsWith(prefix)) continue;
    if (pickMetric(s) <= 0) continue;
    const day = parseInt(d.slice(8, 10), 10);
    if (Number.isFinite(day) && day > maxDay) maxDay = day;
  }
  return maxDay;
}

export function lastRevenueSalesDayInMonth(
  monthSales: SalesSummaryLike[] | null | undefined,
  year: number,
  month: number,
): number {
  return lastMetricDayInMonth(monthSales, year, month, pickRevenue);
}

/**
 * يوم نهاية الفترة: min(حد التقويم، آخر يوم فيه قيمة للمقيّد) عند capAtLastMetricDay.
 */
export function resolvePeriodEndDay(params: {
  year: number;
  month: number;
  todayYear: number;
  todayMonth: number;
  todayDay: number;
  monthSales?: SalesSummaryLike[] | null;
  pickMetric?: (s: SalesSummaryLike) => number;
  capAtLastMetricDay?: boolean;
}): number {
  const {
    year,
    month,
    todayYear,
    todayMonth,
    todayDay,
    monthSales,
    pickMetric = pickRevenue,
    capAtLastMetricDay = true,
  } = params;

  const calendarCap = mtdCalendarDaysInMonth(year, month, todayYear, todayMonth, todayDay);
  if (calendarCap <= 0) return 0;
  if (!capAtLastMetricDay) return calendarCap;

  const lastEntry = lastMetricDayInMonth(monthSales, year, month, pickMetric);
  if (lastEntry <= 0) return calendarCap;
  return Math.min(calendarCap, lastEntry);
}

/** يوم نهاية MTD للإيرادات — alias واضح لـ resolvePeriodEndDay. */
export function revenueMtdEndDay(
  year: number,
  month: number,
  todayYear: number,
  todayMonth: number,
  todayDay: number,
  monthSales?: SalesSummaryLike[] | null,
): number {
  return resolvePeriodEndDay({
    year,
    month,
    todayYear,
    todayMonth,
    todayDay,
    monthSales,
    pickMetric: pickRevenue,
  });
}

/** نهاية فترة شهر في جدول المعدل السنوي (شهر كامل، MTD، أو محاذاة مع الشهر السابق). */
export function resolveYearlyMonthEndDay(params: {
  year: number;
  month: number;
  capMonth: number;
  currentYear: number;
  currentMonth: number;
  currentDay: number;
  prevMonthAlignEndDay?: number;
}): number {
  const { year, month, capMonth, currentYear, currentMonth, currentDay, prevMonthAlignEndDay } =
    params;

  const mtdAlignDay =
    prevMonthAlignEndDay != null &&
    year === currentYear &&
    capMonth === currentMonth &&
    (month === capMonth || month === capMonth - 1)
      ? prevMonthAlignEndDay
      : null;

  if (mtdAlignDay != null) {
    return Math.max(1, Math.min(mtdAlignDay, lastDayOfMonth(year, month)));
  }

  return mtdCalendarDaysInMonth(year, month, currentYear, currentMonth, currentDay);
}

export function sumRevenueThroughDay(
  monthSales: SalesSummaryLike[] | null | undefined,
  year: number,
  month: number,
  endDayInclusive: number,
): number {
  return sumMonthMetric(monthSales, year, month, pickRevenue, endDayInclusive);
}

export function sumCustomersThroughDay(
  monthSales: SalesSummaryLike[] | null | undefined,
  year: number,
  month: number,
  endDayInclusive: number,
): number {
  return sumMonthMetric(monthSales, year, month, pickCustomers, endDayInclusive);
}

/**
 * المعدل اليومي لشهر كامل من ملخصات المبيعات.
 * عند تمرير endDayInclusive يُستخدم مباشرة (مثلاً محاذاة الشهر السابق مع MTD).
 */
export function computeMonthMetricDailyAvg(params: {
  monthSales: SalesSummaryLike[] | null | undefined;
  year: number;
  month: number;
  todayYear: number;
  todayMonth: number;
  todayDay: number;
  pickMetric: (s: SalesSummaryLike) => number;
  endDayInclusive?: number;
}): MonthDailyAvgResult {
  const {
    monthSales,
    year,
    month,
    todayYear,
    todayMonth,
    todayDay,
    pickMetric,
    endDayInclusive,
  } = params;

  const endDay =
    endDayInclusive != null && endDayInclusive > 0
      ? Math.max(0, Math.min(endDayInclusive, lastDayOfMonth(year, month)))
      : resolvePeriodEndDay({
          year,
          month,
          todayYear,
          todayMonth,
          todayDay,
          monthSales,
          pickMetric,
        });

  if (endDay <= 0) {
    return { total: 0, calendarDays: 0, endDayInclusive: 0, avgDaily: null };
  }

  const total = sumMonthMetric(monthSales, year, month, pickMetric, endDay);
  return {
    total,
    calendarDays: endDay,
    endDayInclusive: endDay,
    avgDaily: dailyAvgFromTotal(total, endDay),
  };
}

export function computeRevenueMonthDailyAvg(
  params: Omit<Parameters<typeof computeMonthMetricDailyAvg>[0], 'pickMetric'>,
): MonthDailyAvgResult {
  return computeMonthMetricDailyAvg({ ...params, pickMetric: pickRevenue });
}

export function computeCustomerMonthDailyAvg(
  params: Omit<Parameters<typeof computeMonthMetricDailyAvg>[0], 'pickMetric'>,
): MonthDailyAvgResult {
  return computeMonthMetricDailyAvg({ ...params, pickMetric: pickCustomers });
}

/** عدد أيام التقويم (1…endDay) التي فيها إيراد مبيعات > 0 — للرؤى فقط. */
export function countRevenueActiveSalesDays(
  monthSales: SalesSummaryLike[] | null | undefined,
  year: number,
  month: number,
  endDayInclusive: number,
): number {
  const rows = filterSalesThroughDay(monthSales, year, month, endDayInclusive);
  const byDay = new Map<string, number>();
  for (const s of rows) {
    const d = toYmd(s.transactionDate);
    if (!d) continue;
    byDay.set(d, (byDay.get(d) || 0) + pickRevenue(s));
  }
  let n = 0;
  for (const amt of byDay.values()) {
    if (amt > 0) n += 1;
  }
  return n;
}

/** @deprecated منطق «أيام البيع فقط» — للاختبارات والتوافق القديم فقط. */
function computeDailyAvgActiveDays(
  monthSalesForDailyAvg: SalesSummaryLike[] | null | undefined,
  pickDayValue: (summary: SalesSummaryLike) => number,
): number | null {
  if (!monthSalesForDailyAvg?.length) return null;
  const byDay = new Map<string, number>();
  monthSalesForDailyAvg.forEach((s) => {
    const d = toYmd(s.transactionDate);
    byDay.set(d, (byDay.get(d) || 0) + pickDayValue(s));
  });
  let sum = 0;
  let n = 0;
  for (const amt of byDay.values()) {
    if (amt > 0) {
      sum += amt;
      n += 1;
    }
  }
  if (n === 0) return null;
  return sum / n;
}

/** @deprecated */
export function computeRevenueDailyAvgActiveDays(
  monthSalesForDailyAvg: SalesSummaryLike[] | null | undefined,
): number | null {
  return computeDailyAvgActiveDays(monthSalesForDailyAvg, pickRevenue);
}

/** @deprecated */
export function computeCustomerDailyAvgActiveDays(
  monthSalesForDailyAvg: SalesSummaryLike[] | null | undefined,
): number | null {
  return computeDailyAvgActiveDays(monthSalesForDailyAvg, pickCustomers);
}
