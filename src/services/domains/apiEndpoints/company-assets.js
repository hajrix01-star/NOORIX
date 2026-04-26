import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

// ——— سجل الأصول (ضمان، مدة) ———
export async function getCompanyAssets(companyId, { warrantyFilter, q, page = 1, pageSize = 50 } = {}) {
  const params = { companyId, page: String(page), pageSize: String(pageSize) };
  if (warrantyFilter) params.warrantyFilter = warrantyFilter;
  if (q && String(q).trim()) params.q = String(q).trim();
  return apiGet('/api/v1/company-assets', params);
}
export async function getCompanyAsset(id, companyId) {
  return apiGet(`/api/v1/company-assets/${id}`, { companyId });
}
export async function createCompanyAsset(body) {
  return apiPost('/api/v1/company-assets', body);
}
export async function updateCompanyAsset(id, companyId, body) {
  return apiPatch(`/api/v1/company-assets/${id}?companyId=${companyId}`, body);
}
export async function deleteCompanyAsset(id, companyId) {
  return apiDelete(`/api/v1/company-assets/${id}?companyId=${companyId}`);
}
export async function getPendingWarrantyInvoices(companyId) {
  return apiGet('/api/v1/company-assets/pending-invoices', { companyId });
}
export async function completeCompanyAssetFromInvoice(body) {
  return apiPost('/api/v1/company-assets/complete-from-invoice', body);
}
