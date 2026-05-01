/**
 * تاريخ/نطاقات بسيطة لـ Dashboard overview (عرض فقط).
 */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** الشهر التقويمي السابق (يناير → ديسمبر السنة السابقة). */
export function prevCalendarMonth(year: number, month: number): { year: number; month: number } {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}
