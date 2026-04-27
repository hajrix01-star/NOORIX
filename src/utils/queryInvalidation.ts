/**
 * queryInvalidation — إبطال الكاش المركزي للعمليات المالية.
 * أي mutation يؤثر على الفواتير/الحركات/الخزائن يجب أن يستدعي invalidateOnFinancialMutation
 * لضمان تحديث التقارير والقوائم واللوحات مباشرة (نفس نمط ERP/SaaS: إبطال بعد كل تغيير).
 *
 * مفاتيح **لا** تُبطل هنا (عمداً): `me`، `companies`، `users`، `roles`، `permissions-schema`،
 * `backup-*`، `health`، وبlobs الصور `ocr-invoice-image` (إعادة جلب ثقيلة؛ تبقى staleTime).
 *
 * @see docs/PERFORMANCE_AND_DATA.md
 */

const FINANCIAL_QUERY_PREFIXES = [
  ['invoices'],
  ['invoice-creator-filter-options'],
  ['vaults'],
  ['payment-vaults'],
  ['vault-transactions'],
  ['sales-summaries'],
  ['sales-dashboard-pack'],
  ['sales-summaries-paged'],
  ['sales-channels'],
  ['purchase-batch-summaries'],
  ['ledger'],
  ['reports'],
  ['categories'],
  ['company'],
  ['vat-planning'],
  // كشوف بنك — تتقاطع مع التدفقات بعد فواتير/مبيعات/تحويلات
  ['bank-statements'],
  ['bank-statements-summary'],
  ['bank-statement'],
  ['bank-reconciliation-stats'],
  ['bank-statement-categories'],
  ['bank-statement-templates'],
  ['bank-classification-rules'],
  ['bank-tree-categories'],
  ['bank-statement-mapping'],
  // لوحة المالك — تجميع مبيعات يومية
  ['owner-daily-sales'],
  // OCR — قوائم مرتبطة بالمشتريات/الفواتير بعد إبطال مالي
  ['ocr-invoices'],
  ['ocr-purchases-report'],
  ['ocr-suppliers'],
  ['ocr-accounting-supplier-suggestions'],
  ['ocr-catalog-accounting-suggestions'],
  ['accounting-suppliers-ocr-catalog'],
  ['ocr-items'],
  ['ocr-price-alerts'],
  ['ocr-review-queue'],
  ['expense-lines'],
  ['expense-line'],
  ['expense-line-payments'],
  ['orders'],
  ['orders-summary'],
  ['orders-items-report'],
  ['order-products'],
  ['order-categories'],
  ['product-purchase-history'],
  ['category-purchase-history'],
  ['payroll-runs'],
  ['payroll-run'],
  ['payroll-run-items'],
  ['invoice-day-close'],
  ['suppliers'],
  ['deductions'],
  ['company-assets'],
  // حركات الموظفين (صرف/ترقية/إنهاء) — تتأثر بالفواتير والمسيرات
  ['movements'],
  // HR — سلف/مسيرات/إجازات/إقامة/مستندات تتقاطع مع الفواتير والخزائن
  ['employees'],
  ['employees-paged'],
  ['employee'],
  ['leaves'],
  ['residencies'],
  ['documents'],
  ['leave-salary-settlements'],
  ['leave-salary-settlement-preview'],
  ['termination-settlement-advances'],
  ['termination-settlement-salary-exists'],
  ['custom-allowances'],
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
