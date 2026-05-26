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

/** تسمية الشفت في ملاحظات التوافق مع الخادم القديم — `[شفت: …]` */
export const SHIFT_NOTE_LABEL: Record<SalesShiftValue, string> = {
  morning: 'شفت صباحي',
  evening: 'شفت مسائي',
  all: 'يوم كامل',
};

const SHIFT_NOTE_LABEL_TO_VALUE = Object.fromEntries(
  Object.entries(SHIFT_NOTE_LABEL).map(([k, v]) => [v, k]),
) as Record<string, SalesShiftValue>;

const SHIFT_NOTE_TAG_RE = /\[شفت:\s*([^\]]+)\]/;

export function formatShiftNoteTag(shift: SalesShiftValue): string {
  return `[شفت: ${SHIFT_NOTE_LABEL[shift]}]`;
}

/** استخراج الشفت من ملاحظة التوافق (خادم قديم) */
export function parseShiftFromNotes(notes: unknown): SalesShiftValue | null {
  if (typeof notes !== 'string' || !notes.trim()) return null;
  const m = notes.match(SHIFT_NOTE_TAG_RE);
  if (!m) return null;
  const label = m[1].trim();
  if (SHIFT_NOTE_LABEL_TO_VALUE[label]) return SHIFT_NOTE_LABEL_TO_VALUE[label];
  if (label.includes('صباح')) return 'morning';
  if (label.includes('مساء')) return 'evening';
  if (label.includes('كامل')) return 'all';
  return null;
}

/** شفت فعلي للعرض/التجميع — يفضّل القيمة المحفوظة، ثم الملاحظة، ثم تلميح الإدخال */
export function resolveSalesSummaryShift(
  summary: { shift?: unknown; notes?: unknown },
  knownShift?: SalesShiftValue,
): SalesShiftValue {
  if (knownShift && isSalesShiftValue(knownShift)) return knownShift;
  if (summary.shift === 'morning' || summary.shift === 'evening') return summary.shift;
  const fromNotes = parseShiftFromNotes(summary.notes);
  if (fromNotes && fromNotes !== 'all') return fromNotes;
  if (summary.shift === 'all') return 'all';
  return parseSalesShiftValue(summary.shift, 'all');
}
