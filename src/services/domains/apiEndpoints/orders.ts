import type { ApiParsedResult } from '../../../types/api';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

// ——— الطلبات ———
export async function getOrders(
  companyId: string,
  year: string | number,
  month: string | number,
): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/orders', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function createOrder(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/orders', body);
}
export async function updateOrder(id: string, body: unknown, companyId: string): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/orders/${id}?companyId=${companyId}`, body);
}
export async function cancelOrder(id: string, companyId: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/orders/${id}?companyId=${companyId}`);
}
export async function getOrdersSummary(
  companyId: string,
  year: string | number,
  month: string | number,
): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/orders/summary', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? {} } : { success: false, data: {} };
}
export async function getProductPurchaseHistory(
  companyId: string,
  productId: string,
  year: string | number | null | undefined,
  month: string | number | null | undefined,
): Promise<ApiParsedResult> {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (year != null && year !== '') params.year = String(year);
  if (month != null && month !== '') params.month = String(month);
  const res = await apiGet(`/api/v1/orders/product-history/${productId}`, params);
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function getCategoryPurchaseHistory(
  companyId: string,
  categoryId: string,
  year: string | number | null | undefined,
  month: string | number | null | undefined,
): Promise<ApiParsedResult> {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (year != null && year !== '') params.year = String(year);
  if (month != null && month !== '') params.month = String(month);
  const res = await apiGet(`/api/v1/orders/category-history/${categoryId}`, params);
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function getOrdersItemsReport(
  companyId: string,
  year: string | number,
  month: string | number,
): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/orders/items-report', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function getOrderProducts(companyId: string, section?: string): Promise<ApiParsedResult> {
  const params: Record<string, string> = { companyId };
  if (section) params.section = section;
  const res = await apiGet('/api/v1/orders/products', params);
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function createOrderProduct(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/orders/products', body);
}
export async function createOrderProductsBatch(
  companyId: string,
  products: unknown,
): Promise<ApiParsedResult> {
  return apiPost('/api/v1/orders/products/batch', { companyId, products }, { timeout: 90000 });
}
export async function createOrderCategoriesBatch(
  companyId: string,
  categories: unknown,
): Promise<ApiParsedResult> {
  return apiPost('/api/v1/orders/categories/batch', { companyId, categories }, { timeout: 60000 });
}
export async function updateOrderProduct(
  id: string,
  body: unknown,
  companyId: string,
): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/orders/products/${id}?companyId=${companyId}`, body);
}
export async function getOrderCategories(companyId: string): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/orders/categories', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function createOrderCategory(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/orders/categories', body);
}
export async function updateOrderCategory(
  id: string,
  body: unknown,
  companyId: string,
): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/orders/categories/${id}?companyId=${companyId}`, body);
}
export async function deactivateOrderProductsBulk(
  companyId: string,
  ids: string[],
): Promise<{ deleted: number }> {
  const results = await Promise.all(
    ids.map((id) => apiPatch(`/api/v1/orders/products/${id}?companyId=${companyId}`, { isActive: false })),
  );
  return { deleted: results.filter((r) => r?.success).length };
}
export async function deactivateOrderCategoriesBulk(
  companyId: string,
  ids: string[],
): Promise<{ deleted: number }> {
  const results = await Promise.all(
    ids.map((id) => apiPatch(`/api/v1/orders/categories/${id}?companyId=${companyId}`, { isActive: false })),
  );
  return { deleted: results.filter((r) => r?.success).length };
}

// ——— طلبات الأقسام (Staff Orders) ———

export async function getMyStaffOrders(companyId: string): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/orders/staff/my', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}

export async function createStaffOrder(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/orders/staff', body);
}

export async function updateStaffOrder(id: string, companyId: string, body: unknown): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/orders/staff/${id}?companyId=${companyId}`, body);
}

export async function deleteStaffOrder(id: string, companyId: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/orders/staff/${id}?companyId=${companyId}`);
}

export async function getStaffDigest(companyId: string): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/orders/staff/digest', { companyId });
  return res?.success ? { ...res, data: res.data ?? { sections: [], totalOrders: 0, pendingCount: 0 } } : { success: false, data: { sections: [], totalOrders: 0, pendingCount: 0 } };
}

export async function sendStaffDigest(companyId: string, orderIds?: string[]): Promise<ApiParsedResult> {
  return apiPost(`/api/v1/orders/staff/send-digest?companyId=${companyId}`, { orderIds });
}
