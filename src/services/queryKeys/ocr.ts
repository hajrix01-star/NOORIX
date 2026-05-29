/**
 * مفاتيح React Query — مسار فواتير OCR
 */
export const ocrKeys = {
  invoices: (companyId: string) => ['ocr-invoices', companyId] as const,

  suppliers: (companyId: string) => ['ocr-suppliers', companyId] as const,

  items: (companyId: string) => ['ocr-items', companyId] as const,

  priceAlerts: (companyId: string) => ['ocr-price-alerts', companyId] as const,

  reviewQueue: (companyId: string) => ['ocr-review-queue', companyId] as const,

  purchasesReport: (companyId: string, month: unknown) =>
    ['ocr-purchases-report', companyId, month] as const,

  operationsDashboard: (companyId: string, days: unknown) =>
    ['ocr-operations-dashboard', companyId, days] as const,

  semanticKeywordInsights: (
    companyId: string,
    days: unknown,
    keyword: unknown,
  ) => ['ocr-semantic-keyword-insights', companyId, days, keyword] as const,

  accountingCatalog: (companyId: string) => ['accounting-suppliers-ocr-catalog', companyId] as const,

  catalogAccountingSuggestions: (
    companyId: string,
    viewingId: string,
    ocrNameSuggest: string,
    ocrTaxDigits: string,
  ) =>
    ['ocr-catalog-accounting-suggestions', companyId, viewingId, ocrNameSuggest, ocrTaxDigits] as const,

  accountingSupplierSuggestions: (
    companyId: string,
    prefillOcrSupplierId: string,
    supplierNameForSuggest: string,
    invoiceVatDigits: string,
  ) =>
    [
      'ocr-accounting-supplier-suggestions',
      companyId,
      prefillOcrSupplierId,
      supplierNameForSuggest,
      invoiceVatDigits,
    ] as const,

  /** بادئة إبطال لاقتراحات موردي المحاسبة لشركة */
  accountingSupplierSuggestionsByCompany: (companyId: string) =>
    ['ocr-accounting-supplier-suggestions', companyId] as const,

  invoicesRoot: () => ['ocr-invoices'] as const,

  purchasesReportRoot: () => ['ocr-purchases-report'] as const,

  operationsDashboardRoot: () => ['ocr-operations-dashboard'] as const,

  semanticKeywordInsightsRoot: () => ['ocr-semantic-keyword-insights'] as const,

  suppliersRoot: () => ['ocr-suppliers'] as const,

  accountingSupplierSuggestionsRoot: () => ['ocr-accounting-supplier-suggestions'] as const,

  catalogAccountingSuggestionsRoot: () => ['ocr-catalog-accounting-suggestions'] as const,

  accountingCatalogRoot: () => ['accounting-suppliers-ocr-catalog'] as const,

  itemsRoot: () => ['ocr-items'] as const,

  priceAlertsRoot: () => ['ocr-price-alerts'] as const,

  reviewQueueRoot: () => ['ocr-review-queue'] as const,
};
