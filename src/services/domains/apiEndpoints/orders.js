import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

// ——— الطلبات ———
export async function getOrders(companyId, year, month) {
  const res = await apiGet('/api/v1/orders', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function createOrder(body) {
  return apiPost('/api/v1/orders', body);
}
export async function updateOrder(id, body, companyId) {
  return apiPatch(`/api/v1/orders/${id}?companyId=${companyId}`, body);
}
export async function cancelOrder(id, companyId) {
  return apiDelete(`/api/v1/orders/${id}?companyId=${companyId}`);
}
export async function getOrdersSummary(companyId, year, month) {
  const res = await apiGet('/api/v1/orders/summary', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? {} } : { success: false, data: {} };
}
export async function getProductPurchaseHistory(companyId, productId, year, month) {
  const params = { companyId };
  if (year) params.year = String(year);
  if (month) params.month = String(month);
  const res = await apiGet(`/api/v1/orders/product-history/${productId}`, params);
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function getCategoryPurchaseHistory(companyId, categoryId, year, month) {
  const params = { companyId };
  if (year) params.year = String(year);
  if (month) params.month = String(month);
  const res = await apiGet(`/api/v1/orders/category-history/${categoryId}`, params);
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function getOrdersItemsReport(companyId, year, month) {
  const res = await apiGet('/api/v1/orders/items-report', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function getOrderProducts(companyId) {
  const res = await apiGet('/api/v1/orders/products', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function createOrderProduct(body) {
  return apiPost('/api/v1/orders/products', body);
}
export async function createOrderProductsBatch(companyId, products) {
  return apiPost('/api/v1/orders/products/batch', { companyId, products }, { timeout: 90000 });
}
export async function createOrderCategoriesBatch(companyId, categories) {
  return apiPost('/api/v1/orders/categories/batch', { companyId, categories }, { timeout: 60000 });
}
export async function updateOrderProduct(id, body, companyId) {
  return apiPatch(`/api/v1/orders/products/${id}?companyId=${companyId}`, body);
}
export async function getOrderCategories(companyId) {
  const res = await apiGet('/api/v1/orders/categories', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function createOrderCategory(body) {
  return apiPost('/api/v1/orders/categories', body);
}
export async function updateOrderCategory(id, body, companyId) {
  return apiPatch(`/api/v1/orders/categories/${id}?companyId=${companyId}`, body);
}
