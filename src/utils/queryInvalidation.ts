/**
 * queryInvalidation — إبطال الكاش المركزي للعمليات المالية.
 * أي mutation يؤثر على الفواتير/الحركات/الخزائن يجب أن يستدعي invalidateOnFinancialMutation
 * لضمان تحديث التقارير والقوائم واللوحات مباشرة (نفس نمط ERP/SaaS: إبطال بعد كل تغيير).
 *
 * مفاتيح **لا** تُبطل هنا (عمداً): `me`، `companies`، `users`، `roles`، `permissions-schema`،
 * `backup-*`، `health`، وبlobs الصور `ocr-invoice-image` (إعادة جلب ثقيلة؛ تبقى staleTime).
 *
 * بادئات الإبطال مَعاد صياغتها من `src/services/queryKeys` (دوال *Root) حتى تبقى أسماء المفاتيح
 * مصدرها الوحيد — دون تغيير ترتيب الاستدعاءات أو سلوك React Query.
 *
 * @see docs/PERFORMANCE_AND_DATA.md
 * @see docs/REACT_QUERY_KEYS_GUIDE.md
 */

import type { QueryClient, QueryKey } from '@tanstack/react-query';

import {
  assetKeys,
  bankKeys,
  categoryKeys,
  dashboardKeys,
  employeeKeys,
  expenseKeys,
  hrKeys,
  invoiceKeys,
  ledgerKeys,
  ocrKeys,
  orderKeys,
  ownerKeys,
  purchaseKeys,
  reportKeys,
  salesKeys,
  supplierKeys,
  vatKeys,
  vaultKeys,
} from '../services/queryKeys';

const FINANCIAL_QUERY_PREFIXES: readonly QueryKey[] = [
  invoiceKeys.root(),
  invoiceKeys.creatorFilterOptionsRoot(),
  vaultKeys.root(),
  vaultKeys.paymentVaultsRoot(),
  vaultKeys.vaultTransactionsRoot(),
  salesKeys.summariesRoot(),
  dashboardKeys.salesPackRoot(),
  dashboardKeys.overviewRoot(),
  salesKeys.summariesPagedRoot(),
  salesKeys.channelsRoot(),
  purchaseKeys.batchSummariesRoot(),
  ledgerKeys.root(),
  reportKeys.root(),
  categoryKeys.root(),
  vatKeys.root(),
  // كشوف بنك — تتقاطع مع التدفقات بعد فواتير/مبيعات/تحويلات
  bankKeys.statementsList(),
  bankKeys.statementsSummary(),
  bankKeys.statementDetailRoot(),
  bankKeys.reconciliationStatsRoot(),
  bankKeys.statementCategoriesRoot(),
  bankKeys.statementTemplatesRoot(),
  bankKeys.classificationRulesRoot(),
  bankKeys.treeCategoriesRoot(),
  bankKeys.statementMappingRoot(),
  // لوحة المالك — تجميع مبيعات يومية + overview موحّد
  ownerKeys.dailySalesRoot(),
  ownerKeys.overviewRoot(),
  // HR — ملخص لوحة HR الموحّد
  hrKeys.dashboardSummaryRoot(),
  // OCR — قوائم مرتبطة بالمشتريات/الفواتير بعد إبطال مالي
  ocrKeys.invoicesRoot(),
  ocrKeys.purchasesReportRoot(),
  ocrKeys.suppliersRoot(),
  ocrKeys.accountingSupplierSuggestionsRoot(),
  ocrKeys.catalogAccountingSuggestionsRoot(),
  ocrKeys.accountingCatalogRoot(),
  ocrKeys.itemsRoot(),
  ocrKeys.priceAlertsRoot(),
  ocrKeys.reviewQueueRoot(),
  expenseKeys.linesRoot(),
  expenseKeys.lineRoot(),
  expenseKeys.linePaymentsRoot(),
  orderKeys.listRoot(),
  orderKeys.summaryRoot(),
  orderKeys.itemsReportRoot(),
  orderKeys.productsRoot(),
  orderKeys.categoriesRoot(),
  orderKeys.productPurchaseHistoryRoot(),
  orderKeys.categoryPurchaseHistoryRoot(),
  hrKeys.payrollRunsRoot(),
  hrKeys.payrollRunRoot(),
  hrKeys.payrollRunItemsRoot(),
  invoiceKeys.dayCloseRoot(),
  supplierKeys.root(),
  hrKeys.deductionsRoot(),
  assetKeys.root(),
  // حركات الموظفين (صرف/ترقية/إنهاء) — تتأثر بالفواتير والمسيرات
  hrKeys.movementsRoot(),
  // HR — سلف/مسيرات/إجازات/إقامة/مستندات تتقاطع مع الفواتير والخزائن
  employeeKeys.root(),
  employeeKeys.employeesPagedRoot(),
  employeeKeys.employeeRoot(),
  hrKeys.leavesRoot(),
  hrKeys.residenciesRoot(),
  hrKeys.documentsRoot(),
  hrKeys.leaveSalarySettlementsRoot(),
  hrKeys.leaveSalarySettlementPreviewRoot(),
  hrKeys.terminationSettlementAdvancesRoot(),
  hrKeys.terminationSettlementSalaryExistsRoot(),
  hrKeys.customAllowancesRoot(),
];

/**
 * إبطال جميع الاستعلامات المتأثرة بتغيير مالي (فواتير، مبيعات، مشتريات، مصروفات، حركات).
 * يُستدعى بعد أي create/update/delete/cancel للفواتير أو الحركات.
 *
 * @param queryClient عميل React Query (يُمرَّر من المكوّن/الهوك بعد التحقق من وجوده).
 */
export function invalidateOnFinancialMutation(queryClient: QueryClient | undefined | null) {
  if (!queryClient) return;
  for (const queryKey of FINANCIAL_QUERY_PREFIXES) {
    queryClient.invalidateQueries({ queryKey });
  }
}
