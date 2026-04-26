import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

// ——— الحسابات والفئات ———
export async function getAccounts(companyId) {
  const res = await apiGet('/api/v1/accounts', { companyId });
  return res.success && Array.isArray(res.data) ? res : { success: true, data: [] };
}
export async function getCategories(companyId) {
  return apiGet('/api/v1/categories', { companyId });
}
export async function createCategory(body) { return apiPost('/api/v1/categories', body); }
export async function updateCategory(id, body) { return apiPatch(`/api/v1/categories/${id}`, body); }
export async function deleteCategory(id, companyId) {
  return apiDelete(`/api/v1/categories/${id}?companyId=${companyId}`);
}

// ——— بنود المصاريف (ثابت/متغير) ———
export async function getExpenseLines(companyId: string, kind?: string | null, includeInactive = false) {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (kind) params.kind = String(kind);
  if (includeInactive) params.includeInactive = 'true';
  const res = await apiGet('/api/v1/expense-lines', params);
  return res.success && Array.isArray(res.data) ? res : { success: true, data: [] };
}
export async function getExpenseLine(id, companyId) {
  return apiGet(`/api/v1/expense-lines/${id}`, { companyId });
}
export async function getExpenseLinePayments(id, companyId, startDate, endDate, page = 1, pageSize = 50) {
  const params: Record<string, string> = {
    companyId: String(companyId),
    page: String(page),
    pageSize: String(pageSize),
  };
  if (startDate) params.startDate = String(startDate).slice(0, 10);
  if (endDate) params.endDate = String(endDate).slice(0, 10);
  return apiGet(`/api/v1/expense-lines/${id}/payments`, params);
}
export async function createExpenseLine(body) {
  return apiPost('/api/v1/expense-lines', body);
}
export async function updateExpenseLine(id, body, companyId) {
  return apiPatch(`/api/v1/expense-lines/${id}?companyId=${companyId}`, body);
}
export async function deactivateExpenseLine(id, companyId) {
  return apiPatch(`/api/v1/expense-lines/${id}/deactivate?companyId=${companyId}`, {});
}
