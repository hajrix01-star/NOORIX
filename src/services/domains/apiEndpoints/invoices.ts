import { getAuthToken, getActiveCompanyId } from '../../authStore';
import type { ApiParsedResult } from '../../../types/api';
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

type JsonRecord = Record<string, unknown>;

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
export async function createInvoice(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/invoices', body);
}
export async function createInvoiceBatch(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/invoices/batch', body);
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
}: CreateAdvanceParams): Promise<ApiParsedResult> {
  const date = transactionDate || getSaudiToday();
  const autoNote = employeeName ? `سلفة — ${employeeName}` : 'سلفة';
  const payload: Record<string, unknown> = {
    companyId,
    employeeId,
    vaultId,
    kind: 'advance',
    totalAmount: Number(amount),
    netAmount: Number(amount),
    taxAmount: 0,
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
): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/invoices/${id}?companyId=${companyId}`, body);
}
export async function deleteInvoice(id: string, companyId: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/invoices/${id}?companyId=${companyId}`);
}

/** رفع صورة إيصال أو ملف PDF وربطه بالفاتورة (بعد الإنشاء أو من شاشة التعديل). */
export async function uploadInvoiceAttachment(
  invoiceId: string,
  companyId: string,
  file: File | null | undefined,
): Promise<ApiParsedResult> {
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
): Promise<ApiParsedResult> {
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
      const data = (await res.json().catch(() => ({}))) as JsonRecord;
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
  page: any = 1,
  pageSize: any = 50,
  batchId?: string | null,
  employeeId?: string | null,
  kind?: string,
  sortBy?: string,
  sortDir?: string,
  supplierId?: string,
  q?: string,
  categoryId?: string,
  expenseLineId?: string,
  includeCancelled: any = true,
  hasNotes?: boolean,
  vaultId?: string,
  createdByUserId?: string,
  requireExpenseLine?: string | boolean,
): Promise<ApiParsedResult> {
  const params: Record<string, string> = {
    companyId: String(companyId),
    page: String(page),
    pageSize: String(pageSize),
  };
  // إرسال التاريخ بصيغة YYYY-MM-DD فقط (مثل المبيعات) لتجنب مشاكل الترميز والتوقيت
  if (startDate) params.startDate = toYmd(startDate);
  if (endDate) params.endDate = toYmd(endDate);
  if (batchId) params.batchId = batchId;
  if (employeeId) params.employeeId = employeeId;
  if (kind) params.kind = kind;
  if (sortBy) params.sortBy = sortBy;
  if (sortDir) params.sortDir = sortDir;
  if (supplierId) params.supplierId = supplierId;
  if (categoryId) params.categoryId = categoryId;
  if (expenseLineId) params.expenseLineId = expenseLineId;
  if (vaultId) params.vaultId = vaultId;
  if (createdByUserId) params.createdByUserId = createdByUserId;
  if (requireExpenseLine) params.requireExpenseLine = 'true';
  params.includeCancelled = includeCancelled ? 'true' : 'false';
  if (q && String(q).trim()) params.q = String(q).trim();
  if (hasNotes === true) params.hasNotes = 'true';
  const res = await apiGet('/api/v1/invoices', params);
  if (!res.success) return res;
  const data = (res.data as { data?: unknown } | undefined)?.data ?? res.data;
  const d = data as {
    items?: unknown;
    total?: number;
    page?: number;
    pageSize?: number;
    sums?: unknown;
    sumsByKind?: unknown;
    inflowByVault?: unknown;
    outflowSummary?: unknown;
  };
  return {
    success: true,
    data: {
      items: d?.items ?? data ?? [],
      total: d?.total ?? 0,
      page: d?.page ?? page,
      pageSize: d?.pageSize ?? pageSize,
      sums: d?.sums,
      sumsByKind: Array.isArray(d?.sumsByKind) ? d.sumsByKind : [],
      inflowByVault: Array.isArray(d?.inflowByVault) ? d.inflowByVault : [],
      outflowSummary: d?.outflowSummary ?? {
        purchasesTotal: '0',
        expensesTotal: '0',
        taxTotal: '0',
      },
    },
  };
}

export async function getInvoiceDayCloseReport(companyId: string, date: unknown): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/invoices/day-close-report', {
    companyId,
    date: toYmd(date),
  });
  if (!res.success) return res;
  const data = (res.data as { data?: unknown } | undefined)?.data ?? res.data;
  return { success: true, data };
}

/** مستخدمو النظام الذين لهم فواتير في الشركة — فلتر قائمة الفواتير */
export async function getInvoiceCreatorFilterOptions(
  companyId: string,
): Promise<{ success: boolean; users: unknown[] }> {
  const res = await apiGet('/api/v1/invoices/creator-filter-options', { companyId });
  if (!res.success) return { success: false, users: [] };
  const raw = (res.data as { data?: unknown; users?: unknown } | undefined)?.data ?? res.data;
  const r = raw as { users?: unknown[] } | null;
  return { success: true, users: Array.isArray(r?.users) ? r.users : [] };
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
    const pack = res.data as { items?: unknown[]; total?: number } | undefined;
    const items = pack?.items ?? [];
    total = Number(pack?.total) ?? all.length + items.length;
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
    const pack = res.data as { items?: unknown[]; total?: number } | undefined;
    const { items = [], total = 0 } = pack || {};
    acc.push(...items);
    const t = Number(total) || 0;
    if (acc.length >= t || items.length < pageSize) break;
    page += 1;
  }
  return acc;
}
