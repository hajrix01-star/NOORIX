import { getAuthToken, getActiveCompanyId, setRefreshToken } from '../../authStore';
import {
  apiGet,
  apiPost,
  apiPatch,
  apiPut,
  apiDelete,
  safeFetch,
  parseResponse,
  getApiBaseUrl,
  throwIfApiFailed,
  getAuthHeaders,
  handleUnauthorized,
} from '../../core/apiHttp';
import { getSaudiToday } from '../../../utils/saudiDate';

// ——— الفواتير ———
export async function createInvoice(body) { return apiPost('/api/v1/invoices', body); }
export async function createInvoiceBatch(body) { return apiPost('/api/v1/invoices/batch', body); }

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
}) {
  const date = transactionDate || getSaudiToday();
  const autoNote = employeeName ? `سلفة — ${employeeName}` : 'سلفة';
  const payload = {
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

export async function updateInvoice(id, body, companyId) {
  return apiPatch(`/api/v1/invoices/${id}?companyId=${companyId}`, body);
}
export async function deleteInvoice(id, companyId) {
  return apiDelete(`/api/v1/invoices/${id}?companyId=${companyId}`);
}

/** رفع صورة إيصال أو ملف PDF وربطه بالفاتورة (بعد الإنشاء أو من شاشة التعديل). */
export async function uploadInvoiceAttachment(invoiceId, companyId, file) {
  if (!file) return { success: false, error: 'لم يُختر ملف' };
  const url = new URL(`/api/v1/invoices/${encodeURIComponent(invoiceId)}/attachment`, getApiBaseUrl());
  url.searchParams.set('companyId', companyId);
  const formData = new FormData();
  formData.append('file', file);
  const token = getAuthToken();
  const cid = companyId || getActiveCompanyId();
  const h = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (cid) h['x-company-id'] = String(cid);
  try {
    const res = await safeFetch(url.toString(), { method: 'POST', headers: h, body: formData });
    return parseResponse(res);
  } catch (err) {
    return { success: false, error: err?.message || 'خطأ في الاتصال', isNetworkError: true };
  }
}

export async function deleteInvoiceAttachment(invoiceId, companyId) {
  const q = encodeURIComponent(companyId);
  return apiDelete(`/api/v1/invoices/${encodeURIComponent(invoiceId)}/attachment?companyId=${q}`);
}

/** تنزيل مرفق الفاتورة المحفوظ على الخادم */
export async function downloadInvoiceAttachment(invoiceId, companyId) {
  const url = new URL(`/api/v1/invoices/${encodeURIComponent(invoiceId)}/attachment/download`, getApiBaseUrl());
  url.searchParams.set('companyId', companyId);
  const token = getAuthToken();
  const cid = companyId || getActiveCompanyId();
  const h = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (cid) h['x-company-id'] = String(cid);
  try {
    const res = await safeFetch(url.toString(), { method: 'GET', headers: h });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || res.statusText || 'فشل التحميل');
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
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function getInvoices(companyId, startDate, endDate, page = 1, pageSize = 50, batchId, employeeId, kind, sortBy, sortDir, supplierId, q, categoryId, expenseLineId, includeCancelled = true, hasNotes, vaultId, createdByUserId, requireExpenseLine) {
  const params = { companyId, page: String(page), pageSize: String(pageSize) };
  // إرسال التاريخ بصيغة YYYY-MM-DD فقط (مثل المبيعات) لتجنب مشاكل الترميز والتوقيت
  if (startDate) params.startDate = String(startDate).slice(0, 10);
  if (endDate)   params.endDate   = String(endDate).slice(0, 10);
  if (batchId)   params.batchId    = batchId;
  if (employeeId) params.employeeId = employeeId;
  if (kind)      params.kind       = kind;
  if (sortBy)    params.sortBy     = sortBy;
  if (sortDir)   params.sortDir    = sortDir;
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
  const data = res.data?.data ?? res.data;
  return {
    success: true,
    data: {
      items: data?.items ?? data ?? [],
      total: data?.total ?? 0,
      page:  data?.page ?? page,
      pageSize: data?.pageSize ?? pageSize,
      sums: data?.sums,
      sumsByKind: Array.isArray(data?.sumsByKind) ? data.sumsByKind : [],
      inflowByVault: Array.isArray(data?.inflowByVault) ? data.inflowByVault : [],
      outflowSummary: data?.outflowSummary ?? {
        purchasesTotal: '0',
        expensesTotal: '0',
        taxTotal: '0',
      },
    },
  };
}

export async function getInvoiceDayCloseReport(companyId, date) {
  const res = await apiGet('/api/v1/invoices/day-close-report', {
    companyId,
    date: String(date || '').slice(0, 10),
  });
  if (!res.success) return res;
  const data = res.data?.data ?? res.data;
  return { success: true, data };
}

/** مستخدمو النظام الذين لهم فواتير في الشركة — فلتر قائمة الفواتير */
export async function getInvoiceCreatorFilterOptions(companyId) {
  const res = await apiGet('/api/v1/invoices/creator-filter-options', { companyId });
  if (!res.success) return { success: false, users: [] };
  const raw = res.data?.data ?? res.data;
  return { success: true, users: Array.isArray(raw?.users) ? raw.users : [] };
}

/** جلب كل فواتير دفعة واحدة (ترقيم متتابع) — للطباعة/التعديل/الإلغاء */
export async function fetchAllInvoicesForBatch(companyId, batchId, startDate, endDate) {
  if (!companyId || !batchId) return [];
  const pageSize = 200;
  let page = 1;
  const all = [];
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
    total = Number(res.data?.total) ?? all.length + items.length;
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
}) {
  if (!companyId) return [];
  const pageSize = 150;
  let page = 1;
  const acc = [];
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
    );
    throwIfApiFailed(res, 'فشل تحميل الفواتير للتصدير');
    const { items = [], total = 0 } = res.data || {};
    acc.push(...items);
    const t = Number(total) || 0;
    if (acc.length >= t || items.length < pageSize) break;
    page += 1;
  }
  return acc;
}


// ——— النسخ الاحتياطي الذكي ———
export async function backupTriggerCompany(companyId) {
  return apiPost('/api/v1/backup/trigger', { scope: 'company', companyId }, { timeout: 180000 });
}

export async function backupListJobs(limit = 40) {
  return apiGet('/api/v1/backup/jobs', { limit: String(limit) });
}

export async function backupRestoreReport(jobId) {
  return apiGet(`/api/v1/backup/jobs/${encodeURIComponent(jobId)}/restore-report`);
}

export async function backupRetryExternal(jobId) {
  return apiPost(`/api/v1/backup/jobs/${encodeURIComponent(jobId)}/retry-external`, {}, { timeout: 120000 });
}

/** تنزيل ملف النسخة (.json.gz) — يستخدم التوكن من authStore */
export async function backupDownloadJobFile(jobId, suggestedName) {
  try {
    const url = new URL(`/api/v1/backup/jobs/${encodeURIComponent(jobId)}/download`, getApiBaseUrl());
    const res = await fetch(url.toString(), { method: 'GET', headers: getAuthHeaders() });
    if (res.status === 401) {
      handleUnauthorized();
      return { success: false, error: 'غير مصرح' };
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || res.statusText };
    }
    const blob = await res.blob();
    const name = suggestedName || `noorix-backup-${jobId}.json.gz`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || 'فشل التنزيل' };
  }
}

export async function backupImportFromJob(body) {
  return apiPost('/api/v1/backup/import', body, { timeout: 600000 });
}

export async function backupGetSystemConfig() {
  return apiGet('/api/v1/backup/system/config');
}

export async function backupPatchSystemConfig(body) {
  return apiPatch('/api/v1/backup/system/config', body);
}

export async function backupListSystemJobs(limit = 20) {
  return apiGet('/api/v1/backup/system/jobs', { limit: String(limit) });
}

/** نسخ نظام كامل (أرشيف tar.gz) — يُفضّل استخدام run-full-archive مباشرة */
export async function backupRunSystemNow() {
  return apiPost('/api/v1/backup/system/run-full-archive', {}, { timeout: 600000 });
}

/** أرشيف نظام: قاعدة (pg_dump custom) + مجلد uploads — قد يستغرق وقتاً */
export async function backupRunSystemFullArchive() {
  return apiPost('/api/v1/backup/system/run-full-archive', {}, { timeout: 600000 });
}

export async function backupVerifySystemJob(jobId) {
  return apiPost(`/api/v1/backup/system/jobs/${encodeURIComponent(jobId)}/verify`, {}, { timeout: 180000 });
}

export async function backupVerifyCompanyJob(jobId) {
  return apiPost(`/api/v1/backup/jobs/${encodeURIComponent(jobId)}/verify`, {}, { timeout: 180000 });
}

export async function backupGetCompanyConfig(companyId) {
  return apiGet('/api/v1/backup/company/config', { companyId });
}

export async function backupPatchCompanyConfig(body) {
  return apiPatch('/api/v1/backup/company/config', body);
}

/** استرداد قاعدة كاملة من نسخة نظام — خطير؛ يتطلب عبارة تأكيد */
export async function backupRestoreSystemFull(jobId, confirmPhrase) {
  return apiPost(
    `/api/v1/backup/system/jobs/${encodeURIComponent(jobId)}/restore`,
    { confirmPhrase },
    { timeout: 600000 },
  );
}

/** تنزيل ملف نسخة القاعدة الكاملة (.dump.gz) — مالك/مدير نظام */
export async function backupDownloadSystemJobFile(jobId, suggestedName) {
  try {
    const url = new URL(`/api/v1/backup/system/jobs/${encodeURIComponent(jobId)}/download`, getApiBaseUrl());
    const res = await fetch(url.toString(), { method: 'GET', headers: getAuthHeaders() });
    if (res.status === 401) {
      handleUnauthorized();
      return { success: false, error: 'غير مصرح' };
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || res.statusText };
    }
    const blob = await res.blob();
    const name = suggestedName || `noorix-full-db-${jobId}.dump.gz`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || 'فشل التنزيل' };
  }
}

/** رفع أرشيف نظام (.tar.gz) من الجهاز — يتحقق الخادم ثم يضيفه لسجل نسخ النظام */
export async function backupUploadSystemFullArchive(file) {
  if (!file) return { success: false, error: 'لم يُختر ملف' };
  const url = new URL('/api/v1/backup/system/upload-full-archive', getApiBaseUrl());
  const formData = new FormData();
  formData.append('file', file);
  const token = getAuthToken();
  const h = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  try {
    const res = await safeFetch(url.toString(), { method: 'POST', headers: h, body: formData }, 600000);
    return parseResponse(res);
  } catch (err) {
    return { success: false, error: err?.message || 'خطأ في الاتصال', isNetworkError: true };
  }
}

/** استرداد مباشر من أرشيف .tar.gz على الجهاز — خطير؛ يتطلب عبارة التأكيد */
export async function backupRestoreSystemFromUpload(file, confirmPhrase) {
  if (!file) return { success: false, error: 'لم يُختر ملف' };
  const url = new URL('/api/v1/backup/system/restore-upload', getApiBaseUrl());
  const formData = new FormData();
  formData.append('file', file);
  formData.append('confirmPhrase', confirmPhrase || '');
  const token = getAuthToken();
  const h = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  try {
    const res = await safeFetch(url.toString(), { method: 'POST', headers: h, body: formData }, 600000);
    return parseResponse(res);
  } catch (err) {
    return { success: false, error: err?.message || 'خطأ في الاتصال', isNetworkError: true };
  }
}

