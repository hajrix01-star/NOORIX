/** حدود الشهر الميلادي بتوقيت UTC (مطابقة لسلوك الطلبات الحالي) */
export function utcBoundsForGregorianMonth(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}
