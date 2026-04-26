import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

// ——— موارد ———
export async function getCompanies(includeArchived = false) {
  return apiGet('/api/v1/companies', includeArchived ? { includeArchived: 'true' } : {});
}

export async function getCompany(id) {
  if (!id) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiGet(`/api/v1/companies/${id}`);
}

/** إعادة تهيئة فئات شركة واحدة — super_admin فقط */
export async function resetCompanyCategories(companyId) {
  return apiPost(`/api/v1/accounting-init/reset-categories/${companyId}`, {});
}

/** إعادة تهيئة فئات جميع الشركات — super_admin فقط */
export async function resetAllCompaniesCategories() {
  return apiPost('/api/v1/accounting-init/reset-all-categories', {});
}

/** إضافة الفئات الناقصة فقط لشركة — بدون حذف أي فئة موجودة */
export async function patchCompanyCategories(companyId) {
  return apiPost(`/api/v1/accounting-init/patch-categories/${companyId}`, {});
}

/** إضافة الفئات الناقصة لجميع الشركات — بدون حذف */
export async function patchAllCompaniesCategories() {
  return apiPost('/api/v1/accounting-init/patch-all-categories', {});
}

export async function getRoles() {
  const res = await apiGet('/api/v1/roles');
  return { success: res.success, data: Array.isArray(res.data) ? res.data : [] };
}

export async function getPermissionsSchema() {
  return apiGet('/api/v1/roles/permissions-schema');
}

export async function createRole(body) { return apiPost('/api/v1/roles', body); }
export async function updateRole(id, body) { return apiPatch(`/api/v1/roles/${id}`, body); }
export async function deleteRole(id) { return apiDelete(`/api/v1/roles/${id}`); }

export async function getUsers() {
  const res = await apiGet('/api/v1/users');
  if (!res.success) return { success: false, error: res.error, data: [] };
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}
export async function createUser(body) { return apiPost('/api/v1/users', body); }
export async function updateUser(id, body) { return apiPatch(`/api/v1/users/${id}`, body); }
export async function archiveUser(id) { return apiPatch(`/api/v1/users/${id}/archive`, {}); }
export async function restoreUser(id) { return apiPatch(`/api/v1/users/${id}/restore`, {}); }
export async function deleteUser(id) { return apiDelete(`/api/v1/users/${id}`); }

export async function createCompany(body) { return apiPost('/api/v1/companies', body); }
export async function updateCompany(id, body) {
  if (!id) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiPatch(`/api/v1/companies/${id}`, body);
}
export async function deleteCompany(id) {
  if (!id) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiDelete(`/api/v1/companies/${id}`);
}

export async function getLedgerEntries(companyId, fromDate, toDate, page = 1, pageSize = 50, q?: string) {
  const params: Record<string, string> = {
    companyId: String(companyId),
    fromDate: String(fromDate),
    toDate: String(toDate),
    page: String(page),
    pageSize: String(pageSize),
  };
  if (q && String(q).trim()) params.q = String(q).trim();
  return apiGet('/api/v1/ledger', params);
}
