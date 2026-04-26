import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

// ——— الموظفون ———
/** قائمة كاملة (حدّ السيرفر) — للتوافق مع الشاشات التي لا ترسل page */
export async function getEmployees(companyId, includeTerminated = false) {
  const res = await apiGet('/api/v1/employees', {
    companyId: companyId || '',
    ...(includeTerminated ? { includeTerminated: 'true' } : {}),
  });
  if (!res.success) return { success: false, error: res.error, data: [] };
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}

/** ترقيم من السيرفر — tab: active | terminated | archived */
export async function getEmployeesPaged(companyId, { tab = 'active', page = 1, pageSize = 50, q = '', sortBy, sortDir } = {}) {
  const params = {
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
  const d = res.data;
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
export async function getEmployeesBulk(companyId, tab = 'active') {
  const res = await apiGet('/api/v1/employees', {
    companyId: companyId || '',
    bulk: '1',
    tab,
  });
  if (!res.success) return { success: false, error: res.error, data: [] };
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}
export async function getEmployee(id, companyId) {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiGet(`/api/v1/employees/${id}`, { companyId });
}
export async function createEmployee(body) {
  return apiPost('/api/v1/employees', body);
}
export async function createEmployeesBatch(body) {
  return apiPost('/api/v1/employees/batch', body);
}
export async function updateEmployee(id, body, companyId) {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiPatch(`/api/v1/employees/${id}?companyId=${companyId}`, body);
}
export async function terminateEmployee(id, companyId) {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiPatch(`/api/v1/employees/${id}/terminate?companyId=${companyId}`, {});
}

/** حذف الموظف نهائياً من قاعدة البيانات — يتطلب صلاحية EMPLOYEES_DELETE */
export async function deleteEmployee(id, companyId) {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiDelete(`/api/v1/employees/${encodeURIComponent(id)}?companyId=${encodeURIComponent(companyId)}`);
}
