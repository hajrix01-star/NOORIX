/**
 * مفاتيح React Query — الطلبات والمنتجات المرتبطة
 */
export const orderKeys = {
  /** بادئة إبطال كل استعلامات قائمة الطلبات */
  listRoot: () => ['orders'] as const,
  /** بادئة إبطال ملخص الطلبات */
  summaryRoot: () => ['orders-summary'] as const,
  /** بادئة إبطال ملخص الطلبات بحسب نطاق التاريخ */
  rangeSummaryRoot: () => ['orders-range-summary'] as const,
  itemsReportRoot: () => ['orders-items-report'] as const,
  productsRoot: () => ['order-products'] as const,
  categoriesRoot: () => ['order-categories'] as const,
  productPurchaseHistoryRoot: () => ['product-purchase-history'] as const,
  categoryPurchaseHistoryRoot: () => ['category-purchase-history'] as const,
  shishaInventoryRoot: () => ['shisha-inventory'] as const,

  list: (companyId: string, year: unknown, month: unknown) =>
    ['orders', companyId, year, month] as const,

  summary: (companyId: string, year: unknown, month: unknown) =>
    ['orders-summary', companyId, year, month] as const,

  rangeSummary: (companyId: string, startDate: unknown, endDate: unknown) =>
    ['orders-range-summary', companyId, startDate, endDate] as const,

  products: (companyId: string) => ['order-products', companyId] as const,

  categories: (companyId: string) => ['order-categories', companyId] as const,

  productPurchaseHistory: (companyId: string, productId: unknown, year: unknown, month: unknown) =>
    ['product-purchase-history', companyId, productId, year, month] as const,

  categoryPurchaseHistory: (companyId: string, categoryId: unknown, year: unknown, month: unknown) =>
    ['category-purchase-history', companyId, categoryId, year, month] as const,

  itemsReport: (companyId: string, year: unknown, month: unknown) =>
    ['orders-items-report', companyId, year, month] as const,

  itemsReportRange: (companyId: string, startDate: unknown, endDate: unknown) =>
    ['orders-items-report-range', companyId, startDate, endDate] as const,

  staffMyRoot: () => ['staff-orders-my'] as const,
  staffMy: (companyId: string) => ['staff-orders-my', companyId] as const,

  shishaInventory: (companyId: string, startDate: string, endDate: string) =>
    ['shisha-inventory', companyId, startDate, endDate] as const,
};
