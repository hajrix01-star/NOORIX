import type { ApiParsedResult } from '../../../types/api';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

// ——— موارد ———
export async function getCompanies(includeArchived = false): Promise<ApiParsedResult> {
  return apiGet('/api/v1/companies', includeArchived ? { includeArchived: 'true' } : {});
}

export async function getCompany(id: string): Promise<ApiParsedResult> {
  if (!id) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiGet(`/api/v1/companies/${id}`);
}

/** إعادة تهيئة فئات شركة واحدة — super_admin فقط */
export async function resetCompanyCategories(companyId: string): Promise<ApiParsedResult> {
  return apiPost(`/api/v1/accounting-init/reset-categories/${companyId}`, {});
}

/** إعادة تهيئة فئات جميع الشركات — super_admin فقط */
export async function resetAllCompaniesCategories(): Promise<ApiParsedResult> {
  return apiPost('/api/v1/accounting-init/reset-all-categories', {});
}

/** إضافة الفئات الناقصة فقط لشركة — بدون حذف أي فئة موجودة */
export async function patchCompanyCategories(companyId: string): Promise<ApiParsedResult> {
  return apiPost(`/api/v1/accounting-init/patch-categories/${companyId}`, {});
}

/** إضافة الفئات الناقصة لجميع الشركات — بدون حذف */
export async function patchAllCompaniesCategories(): Promise<ApiParsedResult> {
  return apiPost('/api/v1/accounting-init/patch-all-categories', {});
}

export async function getRoles(): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/roles');
  return { success: res.success, data: Array.isArray(res.data) ? res.data : [] };
}

export async function getPermissionsSchema(): Promise<ApiParsedResult> {
  return apiGet('/api/v1/roles/permissions-schema');
}

export async function createRole(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/roles', body);
}
export async function updateRole(id: string, body: unknown): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/roles/${id}`, body);
}
export async function deleteRole(id: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/roles/${id}`);
}

export async function getUsers(): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/users');
  if (!res.success) return { success: false, error: res.error, data: [] };
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}
export async function createUser(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/users', body);
}
export async function updateUser(id: string, body: unknown): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/users/${id}`, body);
}
export async function archiveUser(id: string): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/users/${id}/archive`, {});
}
export async function restoreUser(id: string): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/users/${id}/restore`, {});
}
export async function deleteUser(id: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/users/${id}`);
}

export async function createCompany(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/companies', body);
}
export async function updateCompany(id: string, body: unknown): Promise<ApiParsedResult> {
  if (!id) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiPatch(`/api/v1/companies/${id}`, body);
}
export async function deleteCompany(id: string): Promise<ApiParsedResult> {
  if (!id) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiDelete(`/api/v1/companies/${id}`);
}

export async function getLedgerEntries(
  companyId: string,
  fromDate: string,
  toDate: string,
  page = 1,
  pageSize = 50,
  q?: string,
): Promise<ApiParsedResult> {
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
