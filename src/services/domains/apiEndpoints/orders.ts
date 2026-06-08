import type { ApiParsedResult, StaffDigestData, StaffDigestSendResult, OrderCatalogBatchCreateResult } from '../../../types/api';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

// ——— الطلبات ———
export async function getOrders(
  companyId: string,
  year: string | number,
  month: string | number,
): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/orders', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? [] } : res;
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
  return res?.success ? { ...res, data: res.data ?? {} } : res;
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
  return res?.success ? { ...res, data: res.data ?? [] } : res;
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
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}
export async function getOrdersItemsReport(
  companyId: string,
  year: string | number,
  month: string | number,
): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/orders/items-report', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}
export async function getOrderProducts(companyId: string, section?: string, type?: string): Promise<ApiParsedResult> {
  const params: Record<string, string> = { companyId };
  if (section) params.section = section;
  if (type) params.type = type;
  const res = await apiGet('/api/v1/orders/products', params);
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}
export async function createOrderProduct(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/orders/products', body);
}
export async function createOrderProductsBatch(
  companyId: string,
  products: unknown,
): Promise<ApiParsedResult<OrderCatalogBatchCreateResult>> {
  return apiPost<OrderCatalogBatchCreateResult>('/api/v1/orders/products/batch', { companyId, products }, { timeout: 90000 });
}
export async function createOrderCategoriesBatch(
  companyId: string,
  categories: unknown,
): Promise<ApiParsedResult<OrderCatalogBatchCreateResult>> {
  return apiPost<OrderCatalogBatchCreateResult>('/api/v1/orders/categories/batch', { companyId, categories }, { timeout: 60000 });
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
  return res?.success ? { ...res, data: res.data ?? [] } : res;
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
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}

export async function getStaffSaleNextLogRef(
  companyId: string,
  saleDate: string,
): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/orders/staff/sale-next-ref', { companyId, saleDate });
  return res?.success ? { ...res, data: res.data ?? { logRef: '' } } : res;
}

export async function createStaffOrder(body: unknown): Promise<ApiParsedResult> {
  const companyId = (body as { companyId?: string })?.companyId;
  const q = companyId ? `?companyId=${encodeURIComponent(String(companyId))}` : '';
  return apiPost(`/api/v1/orders/staff${q}`, body);
}

export async function updateStaffOrder(id: string, companyId: string, body: unknown): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/orders/staff/${id}?companyId=${companyId}`, body);
}

export async function deleteStaffOrder(id: string, companyId: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/orders/staff/${id}?companyId=${companyId}`);
}

export async function resendStaffSale(
  id: string,
  companyId: string,
  lang?: 'ar' | 'en',
): Promise<ApiParsedResult> {
  return apiPost(`/api/v1/orders/staff/${id}/resend?companyId=${companyId}`, { lang });
}

export async function getSalesReport(companyId: string, days = 30): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/orders/sales/report', { companyId, days: String(days) });
  return res?.success ? { ...res, data: res.data ?? {} } : res;
}

export async function getDigestHistory(companyId: string, days = 30): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/orders/staff/digest/history', { companyId, days: String(days) });
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}

export async function getStaffDigest(companyId: string): Promise<ApiParsedResult<StaffDigestData>> {
  const res = await apiGet<StaffDigestData>('/api/v1/orders/staff/digest', { companyId });
  const empty: StaffDigestData = { sections: [], totalOrders: 0, pendingCount: 0 };
  return res?.success ? { ...res, data: res.data ?? empty } : res as ApiParsedResult<StaffDigestData>;
}

export async function sendStaffDigest(
  companyId: string,
  body: {
    orderIds?: string[];
    lang?: 'ar' | 'en';
    orderType?: 'external' | 'internal';
    pettyCashAmount?: string;
    orderDate?: string;
    createPurchaseOrder?: boolean;
  } = {},
): Promise<ApiParsedResult<StaffDigestSendResult>> {
  return apiPost<StaffDigestSendResult>(`/api/v1/orders/staff/send-digest?companyId=${companyId}`, body);
}

// ── Sections ──────────────────────────────────────────────────────
export async function getOrderSections(companyId: string): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/orders/sections', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : res;
}
export async function createOrderSection(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/orders/sections', body);
}
export async function deleteOrderSection(id: string, companyId: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/orders/sections/${id}?companyId=${companyId}`);
}
export async function bulkSetProductSections(
  companyId: string,
  productIds: string[],
  opts: { sectionNames?: string[]; sectionIds?: string[]; mode?: 'replace' | 'add' },
): Promise<ApiParsedResult> {
  return apiPost(`/api/v1/orders/products/bulk-sections?companyId=${companyId}`, {
    productIds,
    sectionNames: opts.sectionNames,
    sectionIds: opts.sectionIds,
    mode: opts.mode,
  });
}
