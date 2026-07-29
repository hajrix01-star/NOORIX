import { getAuthToken, getActiveCompanyId } from '../../authStore';
import type {
  ApiParsedResult,
  HrCompensationSnapshot,
  HrCompensationSnapshotsResult,
  HrDocumentUploadResult,
} from '../../../types/api';
import { toYmd } from '../../../utils/saudiDate';
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
import {
  companyDeleteLeaveQuery,
  companyDeleteResidencyQuery,
  companyEmployeeIdsQuery,
  companyEmployeeQuery,
  companyEmployeeYearQuery,
  companyPayrollMonthQuery,
  companyQuery,
  companyYearQuery,
  withHrApiQuery,
} from './hr-query';

type JsonRecord = Record<string, unknown>;
type HrApiRecord = JsonRecord & { id?: string };
type HrApiRecordList = HrApiRecord[] | { items?: HrApiRecord[]; total?: number; page?: number; pageSize?: number };
type HrPayrollRunLine = JsonRecord & {
  employeeId: string;
  employeeName: string;
  grossSalary: number;
  allowancesAdd: number;
  deductions: number;
  advancesDeduct: number;
  netSalary: number;
  deferAdvances: boolean;
  advanceDates: string;
  notes: string;
};
type HrPayrollRunDetail = JsonRecord & {
  id: string;
  items?: HrPayrollRunLine[];
  runNumber?: string | null;
  status?: string | null;
  payrollMonth?: string;
  totalAmount?: number | string | null;
  issuedSalaryInvoiceNumber?: string | number | null;
  notes?: string;
};
type HrLeaveSettlementPreview = {
  suggestedAmount?: number;
  calendarDaysPaid?: number;
  daysInMonth?: number;
};
type HrMutationResult = HrApiRecord | { success?: boolean; invoice?: HrApiRecord; invoiceNumber?: string | number | null };

// ——— HR: مسيرات الرواتب، الإجازات، الإقامات، المستندات ———
export async function getPayrollRuns(companyId: string, year?: string | number): Promise<ApiParsedResult<HrApiRecordList>> {
  return apiGet('/api/v1/hr/payroll-runs', companyYearQuery(companyId, year));
}
export async function getEmployeePayrollItems(companyId: string, employeeId: string): Promise<ApiParsedResult<HrApiRecordList>> {
  return apiGet('/api/v1/hr/payroll-run-items', companyEmployeeQuery(companyId, employeeId));
}
export async function getPayrollRun(id: string, companyId: string): Promise<ApiParsedResult<HrPayrollRunDetail>> {
  return apiGet(`/api/v1/hr/payroll-runs/${encodeURIComponent(id)}`, companyQuery(companyId));
}
export async function createPayrollRun(body: unknown): Promise<ApiParsedResult<HrPayrollRunDetail>> {
  return apiPost('/api/v1/hr/payroll-runs', body);
}
export async function updatePayrollRunStatus(id: string, companyId: string, status: string): Promise<ApiParsedResult<HrPayrollRunDetail>> {
  return apiPatch(withHrApiQuery(`/api/v1/hr/payroll-runs/${encodeURIComponent(id)}/status`, companyQuery(companyId)), { status });
}
export async function updatePayrollRun(id: string, companyId: string, body: unknown): Promise<ApiParsedResult<HrPayrollRunDetail>> {
  return apiPatch(withHrApiQuery(`/api/v1/hr/payroll-runs/${encodeURIComponent(id)}`, companyQuery(companyId)), body);
}
export async function deletePayrollRun(id: string, companyId: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete(withHrApiQuery(`/api/v1/hr/payroll-runs/${encodeURIComponent(id)}`, companyQuery(companyId)));
}
export async function issuePayrollPayment(body: unknown): Promise<ApiParsedResult<HrMutationResult>> {
  return apiPost('/api/v1/hr/payroll-runs/issue-payment', body);
}

export async function getHrAdvances(companyId: string, year?: string | number): Promise<ApiParsedResult<HrApiRecordList>> {
  return apiGet('/api/v1/hr/advances', companyYearQuery(companyId, year));
}

export async function getEmployeeCompensationSnapshot(
  companyId: string,
  employeeId: string,
): Promise<ApiParsedResult<HrCompensationSnapshot>> {
  return apiGet(`/api/v1/hr/employees/${encodeURIComponent(employeeId)}/compensation-snapshot`, companyQuery(companyId));
}

export async function getEmployeeCompensationSnapshots(
  companyId: string,
  employeeIds: string[] = [],
): Promise<ApiParsedResult<HrCompensationSnapshotsResult>> {
  return apiGet('/api/v1/hr/compensation-snapshots', companyEmployeeIdsQuery(companyId, employeeIds));
}

export async function getLeaves(
  companyId: string,
  employeeId?: string,
  year?: string | number,
): Promise<ApiParsedResult<HrApiRecordList>> {
  return apiGet('/api/v1/hr/leaves', companyEmployeeYearQuery(companyId, employeeId, year));
}
export async function createLeave(body: unknown): Promise<ApiParsedResult<HrApiRecord>> {
  return apiPost('/api/v1/hr/leaves', body);
}

export async function updateLeave(id: string, companyId: string, body: unknown): Promise<ApiParsedResult<HrApiRecord>> {
  return apiPatch(withHrApiQuery(`/api/v1/hr/leaves/${encodeURIComponent(id)}`, companyQuery(companyId)), body);
}

export async function updateLeaveStatus(id: string, companyId: string, status: string): Promise<ApiParsedResult<HrApiRecord>> {
  return apiPatch(withHrApiQuery(`/api/v1/hr/leaves/${encodeURIComponent(id)}/status`, companyQuery(companyId)), { status });
}

export async function getLeaveSalarySettlements(
  companyId: string,
  payrollMonth: string | number,
): Promise<ApiParsedResult<HrApiRecordList>> {
  return apiGet('/api/v1/hr/leave-salary-settlements', companyPayrollMonthQuery(companyId, payrollMonth));
}

export async function getLeaveSalarySettlementPreview(id: string, companyId: string): Promise<ApiParsedResult<HrLeaveSettlementPreview>> {
  return apiGet(`/api/v1/hr/leaves/${encodeURIComponent(id)}/salary-settlement-preview`, companyQuery(companyId));
}

export async function issueLeaveSalarySettlement(
  id: string,
  companyId: string,
  body: Record<string, unknown> = {},
): Promise<ApiParsedResult<HrMutationResult>> {
  const payload: Record<string, unknown> = {};
  if (body.grossAmount != null && body.grossAmount !== '') {
    const n = Number(body.grossAmount);
    if (Number.isFinite(n)) payload.grossAmount = n;
  }
  if (body.manualOverrideReason != null && String(body.manualOverrideReason).trim()) {
    payload.manualOverrideReason = String(body.manualOverrideReason).trim();
  }
  if (body.vaultId) payload.vaultId = body.vaultId;
  return apiPost(withHrApiQuery(`/api/v1/hr/leaves/${encodeURIComponent(id)}/salary-settlement`, companyQuery(companyId)), payload);
}

export async function deleteLeave(id: string, companyId: string, voidSettlement: boolean = false): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete(withHrApiQuery(`/api/v1/hr/leaves/${encodeURIComponent(id)}`, companyDeleteLeaveQuery(companyId, voidSettlement)));
}

export async function returnFromLeave(
  id: string,
  companyId: string,
  actualReturnDate?: string,
): Promise<ApiParsedResult<HrApiRecord>> {
  const body: Record<string, string> = {};
  if (actualReturnDate) body.actualReturnDate = toYmd(actualReturnDate);
  return apiPost(withHrApiQuery(`/api/v1/hr/leaves/${encodeURIComponent(id)}/return`, companyQuery(companyId)), body);
}

export async function getResidencies(companyId: string, employeeId?: string): Promise<ApiParsedResult<HrApiRecordList>> {
  return apiGet('/api/v1/hr/residencies', companyEmployeeQuery(companyId, employeeId));
}
export async function createResidency(body: unknown): Promise<ApiParsedResult<HrApiRecord>> {
  return apiPost('/api/v1/hr/residencies', body);
}
export async function updateResidency(id: string, body: unknown, companyId: string): Promise<ApiParsedResult<HrApiRecord>> {
  return apiPatch(withHrApiQuery(`/api/v1/hr/residencies/${encodeURIComponent(id)}`, companyQuery(companyId)), body);
}
export async function deleteResidency(
  id: string,
  companyId: string,
  voidInvoice = false,
): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete(withHrApiQuery(`/api/v1/hr/residencies/${encodeURIComponent(id)}`, companyDeleteResidencyQuery(companyId, voidInvoice)));
}

export async function issueResidencyInvoice(
  id: string,
  companyId: string,
  body: Record<string, unknown>,
): Promise<ApiParsedResult<HrMutationResult>> {
  return apiPost(`/api/v1/hr/residencies/${encodeURIComponent(id)}/issue-invoice`, {
    companyId,
    ...body,
  });
}

export async function getDocuments(companyId: string, employeeId?: string): Promise<ApiParsedResult<HrApiRecordList>> {
  return apiGet('/api/v1/hr/documents', companyEmployeeQuery(companyId, employeeId));
}
export async function createDocument(body: unknown): Promise<ApiParsedResult<HrApiRecord>> {
  return apiPost('/api/v1/hr/documents', body);
}
export async function uploadDocument(formData: FormData): Promise<ApiParsedResult<HrDocumentUploadResult>> {
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

export async function uploadDocumentFile(opts: {
  companyId: string;
  employeeId: string;
  documentType?: string;
  file: File;
}): Promise<ApiParsedResult<HrDocumentUploadResult>> {
  const { companyId, employeeId, documentType, file } = opts;
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
    const data = (await res.json().catch(() => ({}))) as JsonRecord;
    if (!res.ok) return { success: false, error: String(data?.message ?? data?.error ?? res.statusText) };
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'خطأ في الاتصال', isNetworkError: true };
  }
}
export async function downloadDocument(id: string, companyId: string): Promise<void> {
  const url = new URL(
    withHrApiQuery(`/api/v1/hr/documents/${encodeURIComponent(id)}/download`, companyQuery(companyId)),
    getApiBaseUrl(),
  );
  const h = getAuthHeaders();
  const res = await safeFetch(url.toString(), { method: 'GET', headers: h });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as JsonRecord;
    throw new Error(String(data?.message ?? res.statusText ?? 'فشل التحميل'));
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
export async function deleteDocument(id: string, companyId: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete(withHrApiQuery(`/api/v1/hr/documents/${encodeURIComponent(id)}`, companyQuery(companyId)));
}

export async function getMovements(companyId: string, employeeId?: string): Promise<ApiParsedResult<HrApiRecordList>> {
  return apiGet('/api/v1/hr/movements', companyEmployeeQuery(companyId, employeeId));
}
export async function createMovement(body: unknown): Promise<ApiParsedResult<HrApiRecord>> {
  return apiPost('/api/v1/hr/movements', body);
}
export async function updateRaiseMovement(
  id: string,
  companyId: string,
  body: unknown,
): Promise<ApiParsedResult<HrApiRecord>> {
  return apiPatch(withHrApiQuery(`/api/v1/hr/movements/${encodeURIComponent(id)}/raise`, companyQuery(companyId)), body);
}
export async function deleteRaiseMovement(id: string, companyId: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete(withHrApiQuery(`/api/v1/hr/movements/${encodeURIComponent(id)}/raise`, companyQuery(companyId)));
}

export async function getCustomAllowances(companyId: string, employeeId?: string): Promise<ApiParsedResult<HrApiRecordList>> {
  return apiGet('/api/v1/hr/allowances', companyEmployeeQuery(companyId, employeeId));
}
export async function createCustomAllowance(body: unknown): Promise<ApiParsedResult<HrApiRecord>> {
  return apiPost('/api/v1/hr/allowances', body);
}
export async function deleteCustomAllowance(id: string, companyId: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete(withHrApiQuery(`/api/v1/hr/allowances/${encodeURIComponent(id)}`, companyQuery(companyId)));
}

export async function getDeductions(companyId: string, employeeId?: string): Promise<ApiParsedResult<HrApiRecordList>> {
  return apiGet('/api/v1/hr/deductions', companyEmployeeQuery(companyId, employeeId));
}
export async function createDeduction(body: unknown): Promise<ApiParsedResult<HrApiRecord>> {
  return apiPost('/api/v1/hr/deductions', body);
}
export async function deleteDeduction(id: string, companyId: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete(withHrApiQuery(`/api/v1/hr/deductions/${encodeURIComponent(id)}`, companyQuery(companyId)));
}
