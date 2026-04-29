/** تسميات أنواع الفواتير — يُحافَى على تطابق PeriodAnalyticsStrip */
export const PERIOD_INVOICE_KIND_ORDER = [
  'sale',
  'purchase',
  'expense',
  'fixed_expense',
  'hr_expense',
  'salary',
  'advance',
] as const;

export function periodInvoiceKindLabel(t: (key: string) => string, kind: string): string {
  const m: Record<string, string> = {
    sale: t('categoryTypeSale'),
    purchase: t('categoryTypes'),
    expense: t('categoryTypeExpense'),
    fixed_expense: t('fixedExpenseType'),
    hr_expense: t('invoiceKindHrExpense'),
    salary: t('totalSalary'),
    advance: t('quickAdvance'),
  };
  return m[String(kind)] || String(kind);
}
