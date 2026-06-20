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

type SummaryShiftLike = {
  shift?: unknown;
  notes?: unknown;
  status?: string | null;
};

export function collectActiveShiftsOnDay(
  daySummaries: SummaryShiftLike[] | null | undefined,
): SalesShiftValue[] {
  const out: SalesShiftValue[] = [];
  for (const s of daySummaries ?? []) {
    if (s.status === 'cancelled') continue;
    out.push(resolveSalesSummaryShift(s));
  }
  return out;
}

/** هل يوم الإدخال مكتمل (يوم كامل أو شفتاً صباحي+مسائي)؟ */
export function isDayShiftCoverageComplete(shifts: SalesShiftValue[]): boolean {
  if (shifts.length === 0) return false;
  if (shifts.includes('all')) return true;
  return shifts.includes('morning') && shifts.includes('evening');
}

export function shiftConflictsWithDay(
  existing: SalesShiftValue[],
  candidate: SalesShiftValue,
): boolean {
  if (existing.length === 0) return false;
  if (candidate === 'all') return true;
  if (existing.includes('all')) return true;
  return existing.includes(candidate);
}

/**
 * يوم الإدخال المقترح:
 * - أول يوم ناقص بعد آخر ملخص (حتى اليوم)
 * - إذا آخر يوم فيه شفت واحد فقط → يبقى على نفس اليوم للشفت الثاني
 */
export function suggestSalesEntryDate(
  todayYmd: string,
  lastEntryYmd: string | null | undefined,
  lastDayShifts: SalesShiftValue[] = [],
): string {
  const today = toYmd(todayYmd);
  if (!today) return todayYmd;
  const last = lastEntryYmd ? toYmd(lastEntryYmd) : '';
  if (!last) return today;

  if (!isDayShiftCoverageComplete(lastDayShifts) && lastDayShifts.length > 0) {
    return last;
  }

  if (compareYmd(last, today) >= 0) return today;
  const next = addCalendarDaysYmd(last, 1);
  return compareYmd(next, today) > 0 ? today : next;
}

export type GapDaysResult = {
  days: string[];
  totalCount: number;
  truncated: boolean;
};

const GAP_LIST_CAP = 60;

/** أيام تقويمية بين آخر إدخال والتاريخ المختار (غير شاملة الطرفين). */
export function listGapDaysBetween(
  lastEntryYmd: string | null | undefined,
  targetYmd: string,
): GapDaysResult {
  const target = toYmd(targetYmd);
  const last = lastEntryYmd ? toYmd(lastEntryYmd) : '';
  if (!target || !last || compareYmd(target, last) <= 0) {
    return { days: [], totalCount: 0, truncated: false };
  }
  const days: string[] = [];
  let d = addCalendarDaysYmd(last, 1);
  let totalCount = 0;
  while (compareYmd(d, target) < 0) {
    totalCount += 1;
    if (days.length < GAP_LIST_CAP) days.push(d);
    d = addCalendarDaysYmd(d, 1);
  }
  return {
    days,
    totalCount,
    truncated: totalCount > days.length,
  };
}

export function findDuplicateShiftsForDate(
  daySummaries: SummaryShiftLike[] | null | undefined,
  activeShifts: SalesShiftValue[],
): SalesShiftValue[] {
  const existing = collectActiveShiftsOnDay(daySummaries);
  if (existing.length === 0) return [];
  return activeShifts.filter((shift) => shiftConflictsWithDay(existing, shift));
}
