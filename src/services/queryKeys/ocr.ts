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
};
