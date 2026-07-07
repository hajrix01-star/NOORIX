import type { ApiParsedResult } from '../../../types/api';
import type { CompanyListItem } from '../../../context/appTypes';
import type {
  CompanyCreateBody,
  CompanyMutationResult,
  ResetCompanyCategoriesResult,
} from '../../../modules/Settings/companyTabModel';
import type { SettingsCompany } from '../../../modules/Settings/settingsTypes';
import type {
  CreateUserResult,
  SettingsRole,
  SettingsUser,
  UserUpdateVariables,
} from '../../../modules/Settings/usersTabModel';
import type { PermissionModuleShape } from '../../../modules/Settings/components/rolePermissionGroups';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

type PermissionSchemaResult = {
  modules?: PermissionModuleShape[];
  levels?: Record<string, { ar: string; en: string }>;
};

type LedgerEntriesResult = {
  items?: unknown[];
  total?: number;
  page?: number;
  pageSize?: number;
  [key: string]: unknown;
};

// ——— موارد ———
export async function getCompanies(includeArchived = false): Promise<ApiParsedResult<CompanyListItem[]>> {
  return apiGet<CompanyListItem[]>('/api/v1/companies', includeArchived ? { includeArchived: 'true' } : {});
}

export async function getCompany(id: string): Promise<ApiParsedResult<SettingsCompany>> {
  if (!id) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiGet<SettingsCompany>(`/api/v1/companies/${id}`);
}

/** إعادة تهيئة فئات شركة واحدة — super_admin فقط */
export async function resetCompanyCategories(companyId: string): Promise<ApiParsedResult<ResetCompanyCategoriesResult['data']>> {
  return apiPost<ResetCompanyCategoriesResult['data']>(`/api/v1/accounting-init/reset-categories/${companyId}`, {});
}

/** إعادة تهيئة فئات جميع الشركات — super_admin فقط */
export async function resetAllCompaniesCategories(): Promise<ApiParsedResult<ResetCompanyCategoriesResult['data']>> {
  return apiPost<ResetCompanyCategoriesResult['data']>('/api/v1/accounting-init/reset-all-categories', {});
}

/** إضافة الفئات الناقصة فقط لشركة — بدون حذف أي فئة موجودة */
export async function patchCompanyCategories(companyId: string): Promise<ApiParsedResult<ResetCompanyCategoriesResult['data']>> {
  return apiPost<ResetCompanyCategoriesResult['data']>(`/api/v1/accounting-init/patch-categories/${companyId}`, {});
}

/** إضافة الفئات الناقصة لجميع الشركات — بدون حذف */
export async function patchAllCompaniesCategories(): Promise<ApiParsedResult<ResetCompanyCategoriesResult['data']>> {
  return apiPost<ResetCompanyCategoriesResult['data']>('/api/v1/accounting-init/patch-all-categories', {});
}

export async function getRoles(): Promise<ApiParsedResult<SettingsRole[]>> {
  const res = await apiGet<SettingsRole[]>('/api/v1/roles');
  if (!res.success) return res;
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}

export async function getPermissionsSchema(): Promise<ApiParsedResult<PermissionSchemaResult>> {
  return apiGet<PermissionSchemaResult>('/api/v1/roles/permissions-schema');
}

export async function createRole(body: unknown): Promise<ApiParsedResult<SettingsRole>> {
  return apiPost<SettingsRole>('/api/v1/roles', body);
}
export async function updateRole(id: string, body: unknown): Promise<ApiParsedResult<SettingsRole>> {
  return apiPatch<SettingsRole>(`/api/v1/roles/${id}`, body);
}
export async function deleteRole(id: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete<{ success?: boolean }>(`/api/v1/roles/${id}`);
}

export async function getUsers(): Promise<ApiParsedResult<SettingsUser[]>> {
  const res = await apiGet<SettingsUser[]>('/api/v1/users');
  if (!res.success) return { success: false, error: res.error, data: [] };
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}
export async function createUser(body: unknown): Promise<ApiParsedResult<CreateUserResult['data']>> {
  return apiPost<CreateUserResult['data']>('/api/v1/users', body);
}
export async function updateUser(id: string, body: UserUpdateVariables['body']): Promise<ApiParsedResult<SettingsUser>> {
  return apiPatch<SettingsUser>(`/api/v1/users/${id}`, body);
}
export async function archiveUser(id: string): Promise<ApiParsedResult<SettingsUser>> {
  return apiPatch<SettingsUser>(`/api/v1/users/${id}/archive`, {});
}
export async function restoreUser(id: string): Promise<ApiParsedResult<SettingsUser>> {
  return apiPatch<SettingsUser>(`/api/v1/users/${id}/restore`, {});
}
export async function deleteUser(id: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete<{ success?: boolean }>(`/api/v1/users/${id}`);
}
export async function hardDeleteUser(id: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete<{ success?: boolean }>(`/api/v1/users/${id}/permanent`);
}

export async function createCompany(body: CompanyCreateBody): Promise<ApiParsedResult<CompanyMutationResult['data']>> {
  return apiPost<CompanyMutationResult['data']>('/api/v1/companies', body);
}
export async function updateCompany(id: string, body: unknown): Promise<ApiParsedResult<SettingsCompany>> {
  if (!id) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiPatch<SettingsCompany>(`/api/v1/companies/${id}`, body);
}
export async function deleteCompany(id: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  if (!id) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiDelete<{ success?: boolean }>(`/api/v1/companies/${id}`);
}

export async function getLedgerEntries(
  companyId: string,
  fromDate: string,
  toDate: string,
  page: number = 1,
  pageSize: number = 50,
  q?: string,
): Promise<ApiParsedResult<LedgerEntriesResult>> {
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
