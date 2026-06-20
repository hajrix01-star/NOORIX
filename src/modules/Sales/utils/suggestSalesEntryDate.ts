import { addCalendarDaysYmd } from '../dailySalesScreenUtils';
import { toYmd } from '../../../utils/saudiDate';
import type { SalesShiftValue } from '../constants/salesShift';
import { resolveSalesSummaryShift } from '../constants/salesShift';

export function compareYmd(a: string, b: string): number {
  const ay = toYmd(a);
  const by = toYmd(b);
  if (!ay || !by) return 0;
  if (ay < by) return -1;
  if (ay > by) return 1;
  return 0;
}

/**
 * يوم الإدخال المقترح: أول يوم ناقص بعد آخر ملخص، أو اليوم إن كان متابعاً يومياً.
 */
export function suggestSalesEntryDate(todayYmd: string, lastEntryYmd: string | null | undefined): string {
  const today = toYmd(todayYmd);
  if (!today) return todayYmd;
  const last = lastEntryYmd ? toYmd(lastEntryYmd) : '';
  if (!last) return today;
  if (compareYmd(last, today) >= 0) return today;
  const next = addCalendarDaysYmd(last, 1);
  return compareYmd(next, today) > 0 ? today : next;
}

/** أيام تقويمية بين آخر إدخال والتاريخ المختار (غير شاملة الطرفين). */
export function listGapDaysBetween(
  lastEntryYmd: string | null | undefined,
  targetYmd: string,
): string[] {
  const target = toYmd(targetYmd);
  const last = lastEntryYmd ? toYmd(lastEntryYmd) : '';
  if (!target || !last || compareYmd(target, last) <= 0) return [];
  const gaps: string[] = [];
  let d = addCalendarDaysYmd(last, 1);
  while (compareYmd(d, target) < 0) {
    gaps.push(d);
    d = addCalendarDaysYmd(d, 1);
    if (gaps.length >= 60) break;
  }
  return gaps;
}

type SummaryShiftLike = {
  shift?: unknown;
  notes?: unknown;
  status?: string | null;
};

export function findDuplicateShiftsForDate(
  daySummaries: SummaryShiftLike[] | null | undefined,
  activeShifts: SalesShiftValue[],
): SalesShiftValue[] {
  const existing = new Set<SalesShiftValue>();
  for (const s of daySummaries ?? []) {
    if (s.status === 'cancelled') continue;
    existing.add(resolveSalesSummaryShift(s));
  }
  return activeShifts.filter((shift) => existing.has(shift));
}

export function maxActiveSummaryYmd(
  summaries: Array<{ transactionDate?: string | null; status?: string | null }>,
): string | null {
  let max: string | null = null;
  for (const s of summaries) {
    if (s.status === 'cancelled') continue;
    const ymd = toYmd(s.transactionDate);
    if (!ymd) continue;
    if (!max || compareYmd(ymd, max) > 0) max = ymd;
  }
  return max;
}
