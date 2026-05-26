import type { SalesShiftValue } from './salesShift';

/** اختيار الشفتات في نموذج الإدخال الديناميكي */
export type SalesEntrySelection = {
  fullDay: boolean;
  morning: boolean;
  evening: boolean;
};

export const EMPTY_SALES_ENTRY_SELECTION: SalesEntrySelection = {
  fullDay: false,
  morning: false,
  evening: false,
};

export type ShiftEntryFormState = {
  customerCount: string;
  cashOnHand: string;
  channelAmounts: Record<string, string>;
  notes: string;
};

export function emptyShiftEntryForm(): ShiftEntryFormState {
  return { customerCount: '', cashOnHand: '', channelAmounts: {}, notes: '' };
}

/** الشفتات النشطة للإدخال حسب الاختيار */
export function getActiveEntryShifts(selection: SalesEntrySelection): SalesShiftValue[] {
  if (selection.fullDay) return ['all'];
  const out: SalesShiftValue[] = [];
  if (selection.morning) out.push('morning');
  if (selection.evening) out.push('evening');
  return out;
}

export function hasEntrySelection(selection: SalesEntrySelection): boolean {
  return getActiveEntryShifts(selection).length > 0;
}

/** تبديل شفت — يوم كامل حصري عن الصباحي/المسائي */
export function toggleEntryShift(
  prev: SalesEntrySelection,
  key: keyof SalesEntrySelection,
): SalesEntrySelection {
  if (key === 'fullDay') {
    const nextFull = !prev.fullDay;
    return nextFull
      ? { fullDay: true, morning: false, evening: false }
      : { fullDay: false, morning: false, evening: false };
  }
  if (prev.fullDay) {
    return {
      fullDay: false,
      morning: key === 'morning' ? true : false,
      evening: key === 'evening' ? true : false,
    };
  }
  return { ...prev, [key]: !prev[key] };
}

export function shiftEntryTitleKey(shift: SalesShiftValue): string {
  if (shift === 'morning') return 'salesShiftMorning';
  if (shift === 'evening') return 'salesShiftEvening';
  return 'salesShiftFullDay';
}
