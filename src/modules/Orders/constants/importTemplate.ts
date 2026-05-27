/**
 * علامات صفوف التوضيح في قوالب الاستيراد — تُستبعد تلقائياً عند الاستيراد
 */
export const ORDER_PRODUCTS_TEMPLATE_MARKER_AR = 'مثال صنف طلبات (احذف أو استبدل)';
export const SALE_PRODUCTS_TEMPLATE_MARKER_AR = 'مثال صنف مبيعات (احذف أو استبدل)';
export const ORDER_CATEGORIES_TEMPLATE_MARKER_AR = 'مثال فئة (احذف أو استبدل)';

export type OrderCatalogProductType = 'order' | 'sale';

export function getOrderProductsTemplateMarkerAr(productType: OrderCatalogProductType = 'order') {
  return productType === 'sale' ? SALE_PRODUCTS_TEMPLATE_MARKER_AR : ORDER_PRODUCTS_TEMPLATE_MARKER_AR;
}
