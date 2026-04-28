/**
 * تاريخ/نطاقات بسيطة لـ Dashboard overview (عرض فقط).
 */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
