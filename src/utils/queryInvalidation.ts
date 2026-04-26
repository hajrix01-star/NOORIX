/**
 * queryInvalidation — إبطال الكاش المركزي للعمليات المالية.
 * أي mutation يؤثر على الفواتير/الحركات/الخزائن يجب أن يستدعي invalidateOnFinancialMutation
 * لضمان تحديث التقارير والقوائم واللوحات مباشرة (نفس نمط ERP/SaaS: إبطال بعد كل تغيير).
 *
 * @see docs/PERFORMANCE_AND_DATA.md
 */

const FINANCIAL_QUERY_PREFIXES = [
  ['invoices'],
  ['invoice-creator-filter-options'],
  ['vaults'],
  ['vault-transactions'],
  ['sales-summaries'],
  ['sales-dashboard-pack'],
  ['sales-summaries-paged'],
  ['purchase-batch-summaries'],
  ['ledger'],
  ['reports'],
  ['expense-lines'],
  ['expense-line'],
  ['expense-line-payments'],
  ['orders'],
  ['orders-summary'],
  ['orders-items-report'],
  ['product-purchase-history'],
  ['category-purchase-history'],
  ['payroll-runs'],
  ['payroll-run'],
  ['invoice-day-close'],
  ['suppliers'],
  ['deductions'],
  ['company-assets'],
  // حركات الموظفين (صرف/ترقية/إنهاء) — تتأثر بالفواتير والمسيرات
  ['movements'],
];

/**
 * إبطال جميع الاستعلامات المتأثرة بتغيير مالي (فواتير، مبيعات، مشتريات، مصروفات، حركات).
 * يُستدعى بعد أي create/update/delete/cancel للفواتير أو الحركات.
 *
 * @param {QueryClient} queryClient
 */
export function invalidateOnFinancialMutation(queryClient: any) {
  if (!queryClient) return;
  FINANCIAL_QUERY_PREFIXES.forEach((queryKey: any) => {
    queryClient.invalidateQueries({ queryKey });
  });
}
