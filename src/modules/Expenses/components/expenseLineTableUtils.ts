/** اسم بند المصروف حسب لغة الواجهة */
export function expenseLineDisplayName(
  line: { nameAr?: string | null; nameEn?: string | null } | null | undefined,
  lang: string,
  fallback = '—',
): string {
  if (line == null) return fallback;
  const nameAr = String(line.nameAr ?? '').trim();
  const nameEn = String(line.nameEn ?? '').trim();
  if (lang === 'en') return nameEn || nameAr || fallback;
  return nameAr || nameEn || fallback;
}

/** تسميات قصيرة لنوع بند المصروف (جدول / تصدير) */
export function expenseLineKindShortLabel(
  kind: string | undefined,
  t: (key: string) => string,
): string {
  if (kind === 'fixed_expense') return t('fixedExpenseType');
  if (kind === 'expense') return t('variableExpenseType');
  return kind || '—';
}
