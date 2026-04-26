import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

// ——— الموردون ———
export async function getSuppliers(companyId, page = 1, pageSize = 50, q) {
  const params = { companyId, page, pageSize };
  if (q && String(q).trim()) params.q = String(q).trim();
  return apiGet('/api/v1/suppliers', params);
}
export async function createSupplier(body) { return apiPost('/api/v1/suppliers', body); }
export async function updateSupplier(id, body) { return apiPatch(`/api/v1/suppliers/${id}`, body); }
export async function deleteSupplier(id) { return apiDelete(`/api/v1/suppliers/${id}`); }
export async function setSupplierBookmark(id, isBookmarked) { return apiPatch(`/api/v1/suppliers/${id}/bookmark`, { isBookmarked }); }
