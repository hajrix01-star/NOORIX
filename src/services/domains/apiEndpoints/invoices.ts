import { getAuthToken, getActiveCompanyId } from '../../authStore';
import type { ApiParsedResult, CreateInvoiceBatchResult } from '../../../types/api';
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  safeFetch,
  parseResponse,
  getApiBaseUrl,
  throwIfApiFailed,
} from '../../core/apiHttp';
import { getSaudiToday, toYmd } from '../../../utils/saudiDate';
import { buildInvoiceListApiQuery } from './invoice-list-query';
import {
  normalizeInvoiceListResponse,
  type InvoiceListResponse,
} from './invoice-list-response';
import {
  normalizeDayCloseReportData,
  type DayCloseReportData,
} from '../../../modules/Invoices/dayCloseReportModel';

type JsonRecord = Record<string, unknown>;

type InvoiceMutationResult = {
  id?: string;
  invoiceNumber?: string | null;
  invoice?: {
    id?: string;
    invoiceNumber?: string | null;
  };
  [key: string]: unknown;
};

function readJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function unwrapApiEnvelope(value: unknown) {
  const record = readJsonRecord(value);
  return 'data' in record ? record.data : value;
}

function readUnknownArrayField(value: unknown, key: string) {
  const field = readJsonRecord(value)[key];
  return Array.isArray(field) ? field : [];
}

export type CreateAdvanceParams = {
  employeeId: string;
  companyId: string;
  vaultId: string;
  amount: string | number;
  transactionDate?: string;
  notes?: string;
  employeeName?: string;
  installmentCount?: number;
  installmentAmount?: number;
};

export type FetchAllInvoicesForExportOpts = {
  companyId: string;
  startDate?: string;
  endDate?: string;
  kind?: string;
  sortBy?: string;
  sortDir?: string;
  supplierId?: string;
  supplierCategoryId?: string;
  q?: string;
  categoryId?: string;
  expenseLineId?: string;
  includeCancelled?: boolean;
  hasNotes?: boolean;
  vaultId?: string;
  batchId?: string;
  createdByUserId?: string;
};

// ——— الفواتير ———
export async function createInvoice(body: unknown): Promise<ApiParsedResult<InvoiceMutationResult>> {
  return apiPost('/api/v1/invoices', body);
}
export async function createInvoiceBatch(body: unknown): Promise<ApiParsedResult<CreateInvoiceBatchResult>> {
  return apiPost<CreateInvoiceBatchResult>('/api/v1/invoices/batch', body);
}

/** صرف سلفة لموظف — فاتورة نوع advance عبر المحرك المالي */
export async function createAdvance({
  employeeId,
  companyId,
  vaultId,
  amount,
  transactionDate,
  notes,
  employeeName,
  installmentCount,
  installmentAmount,
}: CreateAdvanceParams): Promise<ApiParsedResult<InvoiceMutationResult>> {
  const date = transactionDate || getSaudiToday();
  const autoNote = employeeName ? `سلفة — ${employeeName}` : 'سلفة';
  const payload: Record<string, unknown> = {
    companyId,
    employeeId,
    vaultId,
    kind: 'advance',
    totalAmount: Number(amount),
    isTaxable: false,
    transactionDate: date,
    notes: notes || autoNote,
  };
  if (installmentCount && installmentCount > 1) {
    payload.installmentCount = installmentCount;
    payload.installmentAmount =
      installmentAmount ?? Math.ceil((Number(amount) / installmentCount) * 100) / 100;
  }
  return createInvoice(payload);
}

export async function updateInvoice(
  id: string,
  body: unknown,
  companyId: string,
): Promise<ApiParsedResult<InvoiceMutationResult>> {
  return apiPatch(`/api/v1/invoices/${id}?companyId=${companyId}`, body);
}
export async function deleteInvoice(id: string, companyId: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete(`/api/v1/invoices/${id}?companyId=${companyId}`);
}

/** رفع صورة إيصال أو ملف PDF وربطه بالفاتورة (بعد الإنشاء أو من شاشة التعديل). */
export async function uploadInvoiceAttachment(
  invoiceId: string,
  companyId: string,
  file: File | null | undefined,
): Promise<ApiParsedResult<InvoiceMutationResult>> {
  if (!file) return { success: false, error: 'لم يُختر ملف' };
  const url = new URL(`/api/v1/invoices/${encodeURIComponent(invoiceId)}/attachment`, getApiBaseUrl());
  url.searchParams.set('companyId', companyId);
  const formData = new FormData();
  formData.append('file', file);
  const token = getAuthToken();
  const cid = companyId || getActiveCompanyId();
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (cid) h['x-company-id'] = String(cid);
  try {
    const res = await safeFetch(url.toString(), { method: 'POST', headers: h, body: formData });
    return parseResponse(res);
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'خطأ في الاتصال', isNetworkError: true };
  }
}

export async function deleteInvoiceAttachment(
  invoiceId: string,
  companyId: string,
): Promise<ApiParsedResult<{ success?: boolean }>> {
  const q = encodeURIComponent(companyId);
  return apiDelete(`/api/v1/invoices/${encodeURIComponent(invoiceId)}/attachment?companyId=${q}`);
}

/** تنزيل مرفق الفاتورة المحفوظ على الخادم */
export async function downloadInvoiceAttachment(invoiceId: string, companyId: string): Promise<void> {
  const url = new URL(`/api/v1/invoices/${encodeURIComponent(invoiceId)}/attachment/download`, getApiBaseUrl());
  url.searchParams.set('companyId', companyId);
  const token = getAuthToken();
  const cid = companyId || getActiveCompanyId();
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (cid) h['x-company-id'] = String(cid);
  try {
    const res = await safeFetch(url.toString(), { method: 'GET', headers: h });
    if (!res.ok) {
      const data = readJsonRecord(await res.json().catch(() => ({})));
      throw new Error(String(data?.message ?? res.statusText ?? 'فشل التحميل'));
    }
    const blob = await res.blob();
    const disp = res.headers.get('content-disposition');
    let fileName = 'attachment';
    if (disp) {
      const m = disp.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;\s]+)/);
      const raw = m ? (m[1] || m[2] || m[3] || '').trim() : '';
      if (raw) {
        try {
          fileName = decodeURIComponent(raw.replace(/^"|"$/g, ''));
        } catch {
          fileName = raw.replace(/^"|"$/g, '');
        }
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (err: unknown) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function getInvoices(
  companyId: string,
  startDate?: string,
  endDate?: string,
  page: number | string = 1,
  pageSize: number | string = 50,
  batchId?: string | null,
  employeeId?: string | null,
  kind?: string,
  sortBy?: string,
  sortDir?: string,
  supplierId?: string,
  supplierCategoryId?: string,
  q?: string,
  categoryId?: string,
  expenseLineId?: string,
  includeCancelled: boolean | string | number = true,
  hasNotes?: boolean,
  vaultId?: string,
  createdByUserId?: string,
  requireExpenseLine?: string | boolean,
): Promise<ApiParsedResult<InvoiceListResponse>> {
  const params = buildInvoiceListApiQuery({
    companyId,
    startDate,
    endDate,
    page,
    pageSize,
    batchId,
    employeeId,
    kind,
    sortBy,
    sortDir,
    supplierId,
    supplierCategoryId,
    q,
    categoryId,
    expenseLineId,
    includeCancelled,
    hasNotes,
    vaultId,
    createdByUserId,
    requireExpenseLine,
  });
  // إرسال التاريخ بصيغة YYYY-MM-DD فقط (مثل المبيعات) لتجنب مشاكل الترميز والتوقيت
  const res = await apiGet('/api/v1/invoices', params);
  if (!res.success) return res;
  return {
    success: true,
    data: normalizeInvoiceListResponse(res.data, { page, pageSize }),
  };
}

export async function getInvoiceDayCloseReport(companyId: string, date: unknown): Promise<ApiParsedResult<DayCloseReportData>> {
  const res = await apiGet('/api/v1/invoices/day-close-report', {
    companyId,
    date: toYmd(date),
  });
  if (!res.success) return res;
  return { success: true, data: normalizeDayCloseReportData(unwrapApiEnvelope(res.data)) };
}

/** مستخدمو النظام الذين لهم فواتير في الشركة — فلتر قائمة الفواتير */
export async function getInvoiceCreatorFilterOptions(
  companyId: string,
): Promise<ApiParsedResult<{ users: unknown[] }>> {
  const res = await apiGet('/api/v1/invoices/creator-filter-options', { companyId });
  if (!res.success) return res;
  const raw = unwrapApiEnvelope(res.data);
  return { success: true, data: { users: readUnknownArrayField(raw, 'users') } };
}

/** جلب كل فواتير دفعة واحدة (ترقيم متتابع) — للطباعة/التعديل/الإلغاء */
export async function fetchAllInvoicesForBatch(
  companyId: string,
  batchId: string,
  startDate: string | undefined,
  endDate: string | undefined,
): Promise<unknown[]> {
  if (!companyId || !batchId) return [];
  const pageSize = 200;
  let page = 1;
  const all: unknown[] = [];
  let total = Infinity;
  const maxPages = 500;
  while (all.length < total && page <= maxPages) {
    const res = await getInvoices(
      companyId,
      startDate,
      endDate,
      page,
      pageSize,
      batchId,
      null,
      'purchase,expense,fixed_expense',
      'transactionDate',
      'asc',
    );
    throwIfApiFailed(res, 'فشل تحميل فواتير الدفعة');
    const items = res.data?.items ?? [];
    total = Number(res.data?.total) || all.length + items.length;
    all.push(...items);
    if (!items.length || items.length < pageSize) break;
    page += 1;
  }
  return all;
}

export async function fetchAllInvoicesForExport({
  companyId,
  startDate,
  endDate,
  kind,
  sortBy = 'transactionDate',
  sortDir = 'desc',
  supplierId,
  supplierCategoryId,
  q,
  categoryId,
  expenseLineId,
  includeCancelled = true,
  hasNotes,
  vaultId,
  batchId,
  createdByUserId,
}: FetchAllInvoicesForExportOpts): Promise<unknown[]> {
  if (!companyId) return [];
  const pageSize = 150;
  let page = 1;
  const acc: unknown[] = [];
  for (let guard = 0; guard < 500; guard++) {
    const res = await getInvoices(
      companyId,
      startDate,
      endDate,
      page,
      pageSize,
      batchId || undefined,
      undefined,
      kind,
      sortBy,
      sortDir,
      supplierId,
      supplierCategoryId,
      q,
      categoryId,
      expenseLineId,
      includeCancelled,
      hasNotes,
      vaultId,
      createdByUserId || undefined,
      undefined,
    );
    throwIfApiFailed(res, 'فشل تحميل الفواتير للتصدير');
    const items = res.data?.items ?? [];
    const total = res.data?.total ?? 0;
    acc.push(...items);
    const t = Number(total) || 0;
    if (acc.length >= t || items.length < pageSize) break;
    page += 1;
  }
  return acc;
}
