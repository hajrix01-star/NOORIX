/** قيمة الشفت المحفوظة في قاعدة البيانات */
export type SalesShiftValue = 'all' | 'morning' | 'evening';

/** اختيار النموذج — فارغ حتى يحدد الموظف */
export type SalesShiftFormValue = SalesShiftValue | '';

/** فلتر قائمة الملخصات */
export type SalesListShiftFilter = 'any' | SalesShiftValue;

export const SALES_SHIFT_VALUES: SalesShiftValue[] = ['all', 'morning', 'evening'];

export function isSalesShiftValue(v: unknown): v is SalesShiftValue {
  return v === 'all' || v === 'morning' || v === 'evening';
}

export function parseSalesShiftValue(v: unknown, fallback: SalesShiftValue = 'all'): SalesShiftValue {
  return isSalesShiftValue(v) ? v : fallback;
}

/** تحويل فلتر القائمة إلى معامل API */
export function listShiftFilterToApiParam(filter: SalesListShiftFilter): SalesShiftValue | undefined {
  if (filter === 'any') return undefined;
  return filter;
}

export function getSalesShiftLabel(shift: unknown, t: (key: string) => string): string {
  if (shift === 'morning') return t('salesShiftMorning');
  if (shift === 'evening') return t('salesShiftEvening');
  return t('salesShiftFullDay');
}
