/**
 * queryInvalidation — إبطال الكاش المركزي للعمليات المالية.
 * أي mutation يؤثر على الفواتير/الحركات/الخزائن يجب أن يستدعي invalidateOnFinancialMutation
 * لضمان تحديث التقارير والقوائم واللوحات مباشرة (نفس نمط ERP/SaaS: إبطال بعد كل تغيير).
 *
 * @see docs/PERFORMANCE_AND_DATA.md
 */

const FINANCIAL_QUERY_PREFIXES = [
  ['invoices'],
  ['vaults'],
  ['sales-summaries'],
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
];

/**
 * إبطال جميع الاستعلامات المتأثرة بتغيير مالي (فواتير، مبيعات، مشتريات، مصروفات، حركات).
 * يُستدعى بعد أي create/update/delete/cancel للفواتير أو الحركات.
 *
 * @param {QueryClient} queryClient
 */
export function invalidateOnFinancialMutation(queryClient) {
  if (!queryClient) return;
  FINANCIAL_QUERY_PREFIXES.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey });
  });
}
