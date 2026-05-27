/** تسميات قصيرة لنوع بند المصروف (جدول / تصدير) */
export function expenseLineKindShortLabel(
  kind: string | undefined,
  t: (key: string) => string,
): string {
  if (kind === 'fixed_expense') return t('fixedExpenseType');
  if (kind === 'expense') return t('variableExpenseType');
  return kind || '—';
}
