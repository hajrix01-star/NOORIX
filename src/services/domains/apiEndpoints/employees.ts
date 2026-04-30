import type { ApiParsedResult } from '../../../types/api';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

type EmployeesPagedOpts = {
  tab?: string;
  page?: number;
  pageSize?: number;
  q?: string;
  sortBy?: string;
  sortDir?: string;
};

// ——— الموظفون ———
/** قائمة كاملة (حدّ السيرفر) — للتوافق مع الشاشات التي لا ترسل page */
export async function getEmployees(companyId: string, includeTerminated: any = false): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/employees', {
    companyId: companyId || '',
    ...(includeTerminated ? { includeTerminated: 'true' } : {}),
  });
  if (!res.success) return { success: false, error: res.error, data: [] };
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}

/** ترقيم من السيرفر — tab: active | terminated | archived */
export async function getEmployeesPaged(
  companyId: string,
  {
    tab = 'active',
    page = 1,
    pageSize = 50,
    q = '',
    sortBy,
    sortDir,
  }: EmployeesPagedOpts = {},
): Promise<ApiParsedResult> {
  const params: Record<string, string> = {
    companyId: companyId || '',
    page: String(page),
    pageSize: String(pageSize),
    tab,
  };
  if (q) params.q = q;
  if (sortBy) params.sortBy = sortBy;
  if (sortDir) params.sortDir = sortDir;
  const res = await apiGet('/api/v1/employees', params);
  if (!res.success) {
    return { success: false, error: res.error, items: [], total: 0, page: 1, pageSize };
  }
  const d = res.data as { items?: unknown[]; total?: number; page?: number; pageSize?: number } | undefined;
  if (d && typeof d === 'object' && Array.isArray(d.items)) {
    return {
      success: true,
      items: d.items,
      total: Number(d.total) || 0,
      page: Number(d.page) || page,
      pageSize: Number(d.pageSize) || pageSize,
    };
  }
  return { success: true, items: [], total: 0, page: 1, pageSize };
}

/** تحميل مجمّع للتصدير (حد أقصى من السيرفر) */
export async function getEmployeesBulk(companyId: string, tab: any = 'active'): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/employees', {
    companyId: companyId || '',
    bulk: '1',
    tab,
  });
  if (!res.success) return { success: false, error: res.error, data: [] };
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}

/** مجموع الراتب الشهري من حقول الموظفين النشطين (أساسي + بدلات) — للتقديرات وحاسبة التكاليف */
export async function getEmployeesMonthlySalaryContractTotal(companyId: string): Promise<ApiParsedResult> {
  if (!companyId) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiGet('/api/v1/employees/monthly-salary-contract-total', { companyId });
}

export async function getEmployee(id: string, companyId: string): Promise<ApiParsedResult> {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiGet(`/api/v1/employees/${id}`, { companyId });
}
export async function createEmployee(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/employees', body);
}
export async function createEmployeesBatch(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/employees/batch', body);
}
export async function updateEmployee(id: string, body: unknown, companyId: string): Promise<ApiParsedResult> {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiPatch(`/api/v1/employees/${id}?companyId=${companyId}`, body);
}
export async function terminateEmployee(id: string, companyId: string): Promise<ApiParsedResult> {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiPatch(`/api/v1/employees/${id}/terminate?companyId=${companyId}`, {});
}

/** حذف الموظف نهائياً من قاعدة البيانات — يتطلب صلاحية EMPLOYEES_DELETE */
export async function deleteEmployee(id: string, companyId: string): Promise<ApiParsedResult> {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiDelete(`/api/v1/employees/${encodeURIComponent(id)}?companyId=${encodeURIComponent(companyId)}`);
}
