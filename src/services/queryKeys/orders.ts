/**
 * مفاتيح React Query — الطلبات والمنتجات المرتبطة
 */
export const orderKeys = {
  list: (companyId: string, year: unknown, month: unknown) =>
    ['orders', companyId, year, month] as const,

  summary: (companyId: string, year: unknown, month: unknown) =>
    ['orders-summary', companyId, year, month] as const,

  products: (companyId: string) => ['order-products', companyId] as const,

  categories: (companyId: string) => ['order-categories', companyId] as const,

  productPurchaseHistory: (companyId: string, productId: unknown, year: unknown, month: unknown) =>
    ['product-purchase-history', companyId, productId, year, month] as const,

  categoryPurchaseHistory: (companyId: string, categoryId: unknown, year: unknown, month: unknown) =>
    ['category-purchase-history', companyId, categoryId, year, month] as const,

  itemsReport: (companyId: string, year: unknown, month: unknown) =>
    ['orders-items-report', companyId, year, month] as const,
};
