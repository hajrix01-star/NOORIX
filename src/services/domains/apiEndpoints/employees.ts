import type { ApiParsedResult, HrEmployee, HrEmployeeTab } from '../../../types/api';
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  getApiBaseUrl,
  getAuthHeaders,
  parseResponse,
  safeFetch,
} from '../../core/apiHttp';
import {
  buildEmployeesPagedApiQuery,
  buildHrApiQuery,
  companyQuery,
  withHrApiQuery,
} from './hr-query';

type EmployeesPagedOpts = {
  tab?: HrEmployeeTab;
  page?: number;
  pageSize?: number;
  q?: string;
  sortBy?: string;
  sortDir?: string;
};

function isHrEmployeeTab(value: unknown): value is HrEmployeeTab {
  return value === 'active' || value === 'terminated' || value === 'archived';
}

// ——— الموظفون ———
/** قائمة كاملة (حدّ السيرفر) — للتوافق مع الشاشات التي لا ترسل page */
export async function getEmployees(companyId: string, includeTerminated: boolean = false): Promise<ApiParsedResult<HrEmployee[]>> {
  const res = await apiGet('/api/v1/employees', buildHrApiQuery({
    companyId: companyId || '',
    includeTerminated: includeTerminated ? true : undefined,
  }));
  if (!res.success) return { success: false, error: res.error, data: [] };
  if (!Array.isArray(res.data)) return { success: false, error: 'استجابة الموظفين غير مطابقة للعقد الرسمي', data: [] };
  return { success: true, data: res.data as HrEmployee[] };
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
): Promise<ApiParsedResult<{ items: HrEmployee[]; total: number; page: number; pageSize: number }, HrEmployee[]>> {
  const params = buildEmployeesPagedApiQuery({ companyId, tab, page, pageSize, q, sortBy, sortDir });
  const res = await apiGet('/api/v1/employees', params);
  if (!res.success) {
    return { success: false, error: res.error, items: [], total: 0, page: 1, pageSize };
  }
  const d = res.data as { items?: HrEmployee[]; total?: number; page?: number; pageSize?: number } | undefined;
  if (d && typeof d === 'object' && Array.isArray(d.items)) {
    return {
      success: true,
      items: d.items,
      total: Number(d.total) || 0,
      page: Number(d.page) || page,
      pageSize: Number(d.pageSize) || pageSize,
    };
  }
  return { success: false, error: 'استجابة قائمة الموظفين المرقمة غير مطابقة للعقد الرسمي', items: [], total: 0, page: 1, pageSize };
}

/** تحميل مجمّع للتصدير (حد أقصى من السيرفر) */
export async function getEmployeesBulk(companyId: string, tab: HrEmployeeTab = 'active'): Promise<ApiParsedResult<HrEmployee[]>> {
  const res = await apiGet('/api/v1/employees', buildHrApiQuery({
    companyId: companyId || '',
    bulk: 1,
    tab: isHrEmployeeTab(tab) ? tab : 'active',
  }));
  if (!res.success) return { success: false, error: res.error, data: [] };
  if (!Array.isArray(res.data)) return { success: false, error: 'استجابة تصدير الموظفين غير مطابقة للعقد الرسمي', data: [] };
  return { success: true, data: res.data as HrEmployee[] };
}

/** مجموع الراتب الشهري من حقول الموظفين النشطين (أساسي + بدلات) — للتقديرات وحاسبة التكاليف */
export async function getEmployeesMonthlySalaryContractTotal(
  companyId: string,
): Promise<ApiParsedResult<{ total?: number | string }>> {
  if (!companyId) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiGet('/api/v1/employees/monthly-salary-contract-total', companyQuery(companyId));
}

export async function getEmployee(id: string, companyId: string): Promise<ApiParsedResult<HrEmployee>> {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiGet(`/api/v1/employees/${encodeURIComponent(id)}`, companyQuery(companyId));
}
export async function createEmployee(body: unknown): Promise<ApiParsedResult<HrEmployee>> {
  return apiPost('/api/v1/employees', body);
}
export async function createEmployeesBatch(body: unknown): Promise<ApiParsedResult<{ items?: HrEmployee[]; created?: number }>> {
  return apiPost('/api/v1/employees/batch', body);
}
export async function updateEmployee(id: string, body: unknown, companyId: string): Promise<ApiParsedResult<HrEmployee>> {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiPatch(withHrApiQuery(`/api/v1/employees/${encodeURIComponent(id)}`, companyQuery(companyId)), body);
}
export async function uploadEmployeePhoto(
  id: string,
  companyId: string,
  file: File,
): Promise<ApiParsedResult<HrEmployee>> {
  if (!id || !companyId) return { success: false, error: 'Ù…Ø¹Ø±Ù Ø§Ù„Ù…ÙˆØ¸Ù ÙˆØ§Ù„Ø´Ø±ÙƒØ© Ù…Ø·Ù„ÙˆØ¨Ø§Ù†' };
  const url = new URL(withHrApiQuery(`/api/v1/employees/${encodeURIComponent(id)}/photo`, companyQuery(companyId)), getApiBaseUrl());
  const headers = getAuthHeaders();
  delete headers['Content-Type'];
  const buildBody = () => {
    const formData = new FormData();
    formData.append('file', file);
    return formData;
  };
  const doFetch = async () => {
    const retryHeaders = getAuthHeaders();
    delete retryHeaders['Content-Type'];
    const retryRes = await safeFetch(url.toString(), {
      method: 'POST',
      headers: retryHeaders,
      body: buildBody(),
    }, 30000);
    return parseResponse<HrEmployee>(retryRes);
  };
  try {
    const res = await safeFetch(url.toString(), {
      method: 'POST',
      headers,
      body: buildBody(),
    }, 30000);
    return parseResponse<HrEmployee>(res, doFetch);
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
  }
}

export async function deleteEmployeePhoto(id: string, companyId: string): Promise<ApiParsedResult<HrEmployee>> {
  if (!id || !companyId) return { success: false, error: 'Ù…Ø¹Ø±Ù Ø§Ù„Ù…ÙˆØ¸Ù ÙˆØ§Ù„Ø´Ø±ÙƒØ© Ù…Ø·Ù„ÙˆØ¨Ø§Ù†' };
  return apiDelete(withHrApiQuery(`/api/v1/employees/${encodeURIComponent(id)}/photo`, companyQuery(companyId)));
}

export async function getEmployeePhotoObjectUrl(id: string, companyId: string): Promise<string> {
  const url = new URL(withHrApiQuery(`/api/v1/employees/${encodeURIComponent(id)}/photo`, companyQuery(companyId)), getApiBaseUrl());
  const res = await safeFetch(url.toString(), {
    method: 'GET',
    headers: getAuthHeaders(),
  }, 30000);
  if (!res.ok) {
    const raw = await res.json().catch(() => ({}));
    const message = Array.isArray(raw?.message)
      ? raw.message.join(', ')
      : raw?.message || raw?.error || 'Employee photo unavailable';
    throw new Error(String(message));
  }
  return URL.createObjectURL(await res.blob());
}

export async function terminateEmployee(id: string, companyId: string): Promise<ApiParsedResult<HrEmployee>> {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiPatch(withHrApiQuery(`/api/v1/employees/${encodeURIComponent(id)}/terminate`, companyQuery(companyId)), {});
}

/** حذف الموظف نهائياً من قاعدة البيانات — يتطلب صلاحية EMPLOYEES_DELETE */
export async function deleteEmployee(id: string, companyId: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiDelete(withHrApiQuery(`/api/v1/employees/${encodeURIComponent(id)}`, companyQuery(companyId)));
}
