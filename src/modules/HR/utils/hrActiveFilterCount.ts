/** عدد الفلاتر النشطة (غير الافتراضية) لشارة الجوال */
export function countTruthyFilters(flags: boolean[]): number {
  return flags.filter(Boolean).length;
}
