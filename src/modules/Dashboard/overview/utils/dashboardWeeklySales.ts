/**
 * تقسيم شهر إلى أسابيع متتالية (1–7، 8–14، …) من ملخصات يومية،
 * مع متوسط يومي لكل جزء = مجموع الجزء ÷ أيام التقويم في الجزء (ضمن حد الشهر/MTD).
 */
import { toYmd } from '../../../../utils/saudiDate';
import { lastDayOfMonth, prevCalendarMonth } from './dashboardOverviewDateUtils';

export type MonthWeekBucket = {
  weekIndex: number;
  dayStart: number;
  dayEnd: number;
  totalSales: number;
  /** متوسط يومي = المجموع ÷ أيام التقويم في الجزء (شامل الأيام بدون مبيعات) */
  avgDailyInWeek: number;
  calendarDaysInSlice: number;
};

export type BucketMonthIntoWeeksOptions = {
  /** للشهر الجاري: قصّ الجزء الأخير حتى هذا اليوم (شامل) */
  maxDayInclusive?: number;
};

/**
 * يوم نهاية فترة جدول الأسابيع — يُوائَم مع كرت الإيرادات (revenueMtdEndDay) عند عرض شهر محدّد.
 */
export function weeklySalesMaxDayInclusive(params: {
  panelYear: number;
  panelMonth: number;
  selectedYear: number | null;
  selectedMonth: number | null;
  revenueMtdEndDay: number;
  saudiNow: { year: number; month: number; day: number };
}): number | undefined {
  const { panelYear, panelMonth, selectedYear, selectedMonth, revenueMtdEndDay, saudiNow } =
    params;

  if (selectedMonth != null && selectedYear != null && revenueMtdEndDay > 0) {
    const isSelected = panelYear === selectedYear && panelMonth === selectedMonth;
    const prev = prevCalendarMonth(selectedYear, selectedMonth);
    const isPrevAligned = panelYear === prev.year && panelMonth === prev.month;
    if (isSelected || isPrevAligned) {
      return revenueMtdEndDay;
    }
  }

  if (panelYear === saudiNow.year && panelMonth === saudiNow.month) {
    return saudiNow.day;
  }

  return undefined;
}

export function bucketMonthIntoWeeks(
  year: number,
  month: number,
  dailySummaries: ReadonlyArray<{ transactionDate?: string | null; totalAmount?: string | number | null }>,
  options?: BucketMonthIntoWeeksOptions,
): MonthWeekBucket[] {
  const ymPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const ld = lastDayOfMonth(year, month);
  const cap =
    options?.maxDayInclusive != null
      ? Math.max(0, Math.min(options.maxDayInclusive, ld))
      : ld;
  if (cap <= 0) return [];

  const byDay = new Map<number, number>();

  for (const s of dailySummaries) {
    const ymdStr = toYmd(s.transactionDate);
    if (!ymdStr || ymdStr.length < 10 || !ymdStr.startsWith(ymPrefix)) continue;
    const d = parseInt(ymdStr.slice(8, 10), 10);
    if (!Number.isFinite(d) || d < 1 || d > cap) continue;
    byDay.set(d, (byDay.get(d) || 0) + Number(s.totalAmount || 0));
  }

  const buckets: MonthWeekBucket[] = [];
  let start = 1;
  let weekIndex = 1;
  while (start <= ld) {
    const end = Math.min(start + 6, ld);
    const effectiveEnd = Math.min(end, cap);
    if (start > cap) break;

    let total = 0;
    const calendarDaysInSlice = Math.max(0, effectiveEnd - start + 1);
    for (let d = start; d <= effectiveEnd; d++) {
      total += byDay.get(d) || 0;
    }
    buckets.push({
      weekIndex,
      dayStart: start,
      dayEnd: end,
      totalSales: total,
      calendarDaysInSlice,
      avgDailyInWeek:
        calendarDaysInSlice > 0 && total > 0 ? total / calendarDaysInSlice : 0,
    });
    start = end + 1;
    weekIndex++;
  }
  return buckets;
}

export function pctChangeVsBaseline(current: number, baseline: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return null;
  if (Math.abs(baseline) < 1e-9) return null;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}
