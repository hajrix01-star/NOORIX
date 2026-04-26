import { getAuthToken, getActiveCompanyId } from '../../authStore';
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  safeFetch,
  parseResponse,
  getApiBaseUrl,
  getAuthHeaders,
} from '../../core/apiHttp';

// ——— HR: مسيرات الرواتب، الإجازات، الإقامات، المستندات ———
export async function getPayrollRuns(companyId, year?: string | number) {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (year != null && year !== '') params.year = String(year);
  return apiGet('/api/v1/hr/payroll-runs', params);
}
export async function getEmployeePayrollItems(companyId, employeeId) {
  return apiGet('/api/v1/hr/payroll-run-items', { companyId, employeeId });
}
export async function getPayrollRun(id, companyId) {
  return apiGet(`/api/v1/hr/payroll-runs/${id}`, { companyId });
}
export async function createPayrollRun(body) {
  return apiPost('/api/v1/hr/payroll-runs', body);
}
export async function updatePayrollRunStatus(id, companyId, status) {
  return apiPatch(`/api/v1/hr/payroll-runs/${id}/status?companyId=${companyId}`, { status });
}
export async function updatePayrollRun(id, companyId, body) {
  return apiPatch(`/api/v1/hr/payroll-runs/${id}?companyId=${companyId}`, body);
}
export async function deletePayrollRun(id, companyId) {
  return apiDelete(`/api/v1/hr/payroll-runs/${id}?companyId=${companyId}`);
}
export async function issuePayrollPayment(body) {
  return apiPost('/api/v1/hr/payroll-runs/issue-payment', body);
}

export async function getHrAdvances(companyId, year?: string | number) {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (year != null) params.year = String(year);
  return apiGet('/api/v1/hr/advances', params);
}

export async function getLeaves(companyId, employeeId?: string, year?: string | number) {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (employeeId) params.employeeId = String(employeeId);
  if (year != null && year !== '') params.year = String(year);
  return apiGet('/api/v1/hr/leaves', params);
}
export async function createLeave(body) {
  return apiPost('/api/v1/hr/leaves', body);
}

export async function updateLeave(id, companyId, body) {
  return apiPatch(`/api/v1/hr/leaves/${encodeURIComponent(id)}?companyId=${encodeURIComponent(companyId)}`, body);
}

export async function updateLeaveStatus(id, companyId, status) {
  return apiPatch(`/api/v1/hr/leaves/${id}/status?companyId=${companyId}`, { status });
}

export async function getLeaveSalarySettlements(companyId, payrollMonth) {
  return apiGet('/api/v1/hr/leave-salary-settlements', { companyId, payrollMonth });
}

export async function getLeaveSalarySettlementPreview(id, companyId) {
  return apiGet(`/api/v1/hr/leaves/${id}/salary-settlement-preview`, { companyId });
}

export async function issueLeaveSalarySettlement(id, companyId, body: Record<string, unknown> = {}) {
  const payload: Record<string, unknown> = {};
  if (body.grossAmount != null && body.grossAmount !== '') {
    const n = Number(body.grossAmount);
    if (Number.isFinite(n)) payload.grossAmount = n;
  }
  if (body.vaultId) payload.vaultId = body.vaultId;
  return apiPost(`/api/v1/hr/leaves/${id}/salary-settlement?companyId=${companyId}`, payload);
}

export async function deleteLeave(id, companyId, voidSettlement = false) {
  let q = `companyId=${encodeURIComponent(companyId)}`;
  if (voidSettlement) q += '&voidSettlement=true';
  return apiDelete(`/api/v1/hr/leaves/${encodeURIComponent(id)}?${q}`);
}

export async function returnFromLeave(id, companyId, actualReturnDate?: string) {
  const body: Record<string, string> = {};
  if (actualReturnDate) body.actualReturnDate = String(actualReturnDate).slice(0, 10);
  return apiPost(`/api/v1/hr/leaves/${id}/return?companyId=${companyId}`, body);
}

export async function getResidencies(companyId, employeeId?: string) {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (employeeId) params.employeeId = String(employeeId);
  return apiGet('/api/v1/hr/residencies', params);
}
export async function createResidency(body) {
  return apiPost('/api/v1/hr/residencies', body);
}
export async function updateResidency(id, body, companyId) {
  return apiPatch(`/api/v1/hr/residencies/${id}?companyId=${companyId}`, body);
}
export async function deleteResidency(id, companyId) {
  return apiDelete(`/api/v1/hr/residencies/${id}?companyId=${companyId}`);
}

export async function getDocuments(companyId, employeeId?: string) {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (employeeId) params.employeeId = String(employeeId);
  return apiGet('/api/v1/hr/documents', params);
}
export async function createDocument(body) {
  return apiPost('/api/v1/hr/documents', body);
}
export async function uploadDocument(formData) {
  const url = new URL('/api/v1/hr/documents/upload', getApiBaseUrl());
  const token = getAuthToken();
  const companyId = getActiveCompanyId();
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (companyId) h['x-company-id'] = String(companyId);
  try {
    const res = await safeFetch(url.toString(), { method: 'POST', headers: h, body: formData });
    return parseResponse(res);
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'خطأ في الاتصال', isNetworkError: true };
  }
}

export async function uploadDocumentFile({ companyId, employeeId, documentType, file }) {
  const url = new URL('/api/v1/hr/documents/upload-file', getApiBaseUrl());
  const formData = new FormData();
  formData.append('file', file);
  formData.append('companyId', companyId);
  formData.append('employeeId', employeeId);
  formData.append('documentType', documentType || 'other');
  const h: Record<string, string> = {};
  const token = getAuthToken();
  const cid = getActiveCompanyId();
  if (token) h.Authorization = `Bearer ${token}`;
  if (cid) h['x-company-id'] = String(cid);
  try {
    const res = await safeFetch(url.toString(), { method: 'POST', headers: h, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data?.message || data?.error || res.statusText };
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'خطأ في الاتصال', isNetworkError: true };
  }
}
export async function downloadDocument(id, companyId) {
  const url = new URL(`/api/v1/hr/documents/${id}/download`, getApiBaseUrl());
  url.searchParams.set('companyId', companyId);
  const h = getAuthHeaders();
  const res = await safeFetch(url.toString(), { method: 'GET', headers: h });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || res.statusText || 'فشل التحميل');
  }
  const blob = await res.blob();
  const disp = res.headers.get('content-disposition');
  let fileName = 'document';
  if (disp) {
    const m = disp.match(/filename="?([^";]+)"?/);
    if (m) fileName = m[1];
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}
export async function deleteDocument(id, companyId) {
  return apiDelete(`/api/v1/hr/documents/${id}?companyId=${companyId}`);
}

export async function getMovements(companyId, employeeId?: string) {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (employeeId) params.employeeId = String(employeeId);
  return apiGet('/api/v1/hr/movements', params);
}
export async function createMovement(body) {
  return apiPost('/api/v1/hr/movements', body);
}

export async function getCustomAllowances(companyId, employeeId?: string) {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (employeeId) params.employeeId = String(employeeId);
  return apiGet('/api/v1/hr/allowances', params);
}
export async function createCustomAllowance(body) {
  return apiPost('/api/v1/hr/allowances', body);
}
export async function deleteCustomAllowance(id, companyId) {
  return apiDelete(`/api/v1/hr/allowances/${id}?companyId=${companyId}`);
}

export async function getDeductions(companyId, employeeId?: string) {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (employeeId) params.employeeId = String(employeeId);
  return apiGet('/api/v1/hr/deductions', params);
}
export async function createDeduction(body) {
  return apiPost('/api/v1/hr/deductions', body);
}
