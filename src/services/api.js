/**
 * Noorix API layer — واجهة موحدة لاستدعاء الـ Backend.
 * - Base URL ديناميكي: VITE_API_URL أولاً، ثم يُستنتج من port المتصفح.
 * - معالجة 401 عالمية → logout تلقائي.
 * - إمساك أخطاء الشبكة → { success: false, isNetworkError: true }.
 * - Timeout 12s لكل طلب.
 */
import { getAuthToken, getActiveCompanyId, getRefreshToken, setAuthToken, setRefreshToken } from './authStore';

// ── Base URL ديناميكي ─────────────────────────────────
function resolveBaseUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    // Frontend Vite dev على 5173/5174 → Backend NestJS على 3000
    if (port === '5173' || port === '5174' || port === '5175') {
      return `${protocol}//${hostname}:3000`;
    }
    // إنتاج: نفس الـ origin (Nginx reverse proxy)
    return '';
  }
  return '';
}

const BASE_URL = resolveBaseUrl();

// ── معالج 401 عالمي ──────────────────────────────────
let _on401 = null;
export function registerOn401Handler(fn) { _on401 = fn; }
function handleUnauthorized() { if (typeof _on401 === 'function') _on401(); }

// ── رؤوس الطلبات ─────────────────────────────────────
function getAuthHeaders() {
  const token     = getAuthToken();
  const companyId = getActiveCompanyId();
  const h = { 'Content-Type': 'application/json' };
  if (token)     h['Authorization'] = `Bearer ${token}`;
  if (companyId) h['x-company-id']  = String(companyId);
  return h;
}

// ── fetch مع timeout وإمساك أخطاء الشبكة ────────────
const TIMEOUT_MS = 12000;
async function safeFetch(url, options, timeout = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(tid);
    return res;
  } catch (err) {
    clearTimeout(tid);
    const msg = err?.name === 'AbortError' ? 'انتهت مهلة الاتصال — جرّب مرة أخرى' : 'السيرفر غير متاح';
    throw Object.assign(new Error(msg), { isNetworkError: true });
  }
}

// ── Auto-refresh: محاولة تجديد التوكن عند 401 ───────
let _refreshPromise = null;
async function tryRefreshToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const url = new URL('/api/v1/auth/refresh', getBase());
      const res = await safeFetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => null);
      if (data?.access_token) {
        setAuthToken(data.access_token);
        if (data.refresh_token) setRefreshToken(data.refresh_token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

/**
 * تجديد الجلسة من refresh_token — يعيد companyIds محدّثة من قاعدة البيانات (مثلاً بعد استيراد شركة).
 * يحدّث التوكن في التخزين؛ استدعِ setToken/setUser من AuthContext لمزامنة واجهة React.
 */
export async function refreshAuthSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return { success: false, error: 'لا يوجد رمز تجديد' };
  }
  try {
    const url = new URL('/api/v1/auth/refresh', getBase());
    const res = await safeFetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = Array.isArray(data?.message)
        ? data.message.join(', ')
        : (data?.message || data?.error || 'فشل تجديد الجلسة');
      return { success: false, error: String(msg) };
    }
    const payload = data?.data ?? data;
    if (payload?.access_token) {
      setAuthToken(payload.access_token);
      if (payload.refresh_token) setRefreshToken(payload.refresh_token);
    }
    return { success: true, data: payload };
  } catch (err) {
    return { success: false, error: err?.message || 'خطأ في الاتصال' };
  }
}

// ── معالجة الاستجابة ─────────────────────────────────
async function parseResponse(res, retryFn) {
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && retryFn) {
    const refreshed = await tryRefreshToken();
    if (refreshed) return retryFn();
    handleUnauthorized();
    return { success: false, error: 'غير مصرح — يُرجى تسجيل الدخول', code: 401 };
  }
  if (res.status === 401) {
    handleUnauthorized();
    return { success: false, error: 'غير مصرح — يُرجى تسجيل الدخول', code: 401 };
  }
  if (!res.ok) {
    const msg = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (data?.message || data?.error || res.statusText);
    return { success: false, error: String(msg || 'خطأ'), code: res.status };
  }
  return { success: true, data: data?.data ?? data };
}

function getBase() {
  return BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
}

/**
 * استدعاء GET.
 */
export async function apiGet(path, params = {}) {
  const url = new URL(path, getBase());
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') url.searchParams.set(k, v); });
  const doFetch = async () => {
    const res = await safeFetch(url.toString(), { method: 'GET', headers: getAuthHeaders() });
    return parseResponse(res);
  };
  try {
    const res = await safeFetch(url.toString(), { method: 'GET', headers: getAuthHeaders() });
    return parseResponse(res, doFetch);
  } catch (err) {
    return { success: false, error: err?.message || 'خطأ في الاتصال', isNetworkError: true };
  }
}

/**
 * استدعاء POST.
 * @param {object} opts - اختياري: { timeout: عدد_الميلي ثانية } — للطلبات الثقيلة مثل تحليل الذكاء
 */
export async function apiPost(path, body = {}, opts = {}) {
  const timeout = opts.timeout ?? TIMEOUT_MS;
  const url = new URL(path, getBase());
  const fetchOpts = { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) };
  const doFetch = async () => {
    const res = await safeFetch(url.toString(), fetchOpts, timeout);
    return parseResponse(res);
  };
  try {
    const res = await safeFetch(url.toString(), fetchOpts, timeout);
    return parseResponse(res, doFetch);
  } catch (err) {
    return { success: false, error: err?.message || 'خطأ في الاتصال', isNetworkError: true };
  }
}

/**
 * استدعاء PATCH.
 */
export async function apiPatch(path, body = {}) {
  const url = new URL(path, getBase());
  const doFetch = async () => {
    const res = await safeFetch(url.toString(), { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(body) });
    return parseResponse(res);
  };
  try {
    const res = await safeFetch(url.toString(), { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(body) });
    return parseResponse(res, doFetch);
  } catch (err) {
    return { success: false, error: err?.message || 'خطأ في الاتصال', isNetworkError: true };
  }
}

/**
 * استدعاء DELETE.
 */
export async function apiDelete(path) {
  const url = new URL(path, getBase());
  const doFetch = async () => {
    const res = await safeFetch(url.toString(), { method: 'DELETE', headers: getAuthHeaders() });
    return parseResponse(res);
  };
  try {
    const res = await safeFetch(url.toString(), { method: 'DELETE', headers: getAuthHeaders() });
    return parseResponse(res, doFetch);
  } catch (err) {
    return { success: false, error: err?.message || 'خطأ في الاتصال', isNetworkError: true };
  }
}

// ——— فحص الاتصال ———
export function getApiBaseUrl() { return BASE_URL || '(dynamic)'; }

export async function checkApiConnection() {
  try {
    const base = getBase();
    const url  = base ? `${base}/api/v1/health` : '/api/v1/health';
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 5000);
    const res  = await fetch(url, { method: 'GET', signal: ctrl.signal }).catch(() => null);
    clearTimeout(tid);
    if (!res) return { ok: false, error: 'السيرفر غير متاح' };
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err?.message };
  }
}

/** جلب حالة الصحة الكاملة (يتضمن geminiAvailable) */
export async function getHealth() {
  try {
    const base = getBase();
    const url  = base ? `${base}/api/v1/health` : '/api/v1/health';
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 8000);
    const res  = await fetch(url, { method: 'GET', headers: getAuthHeaders(), signal: ctrl.signal }).catch(() => null);
    clearTimeout(tid);
    if (!res) return { success: false, error: 'السيرفر غير متاح', isNetworkError: true };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data?.message || res.statusText, status: res.status };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err?.message || 'خطأ في الاتصال', isNetworkError: true };
  }
}

/** اختبار Gemini مباشرة — للتشخيص */
export async function testGemini() {
  return apiGet('/api/v1/gemini-test');
}

/**
 * تسجيل الدخول — إرجاع { access_token, refresh_token, user }.
 */
export async function login(email, password) {
  const res = await apiPost('/api/v1/auth/login', { email, password });
  if (!res.success) return res;
  if (res.data?.refresh_token) {
    setRefreshToken(res.data.refresh_token);
  }
  return { success: true, data: res.data };
}

/**
 * المستخدم الحالي — يتطلب JWT.
 */
export async function getMe() {
  return apiGet('/api/v1/auth/me');
}

/**
 * تغيير كلمة المرور — يتطلب JWT.
 */
export async function changePassword(currentPassword, newPassword) {
  const res = await apiPost('/api/v1/auth/change-password', { currentPassword, newPassword });
  return res;
}

/**
 * المحادثة الذكية — إرسال استعلام والحصول على إجابة.
 */
export async function chatQuery(query) {
  return apiPost('/api/v1/chat/query', { query });
}

/** تحليل كشوف الحساب */
export async function bankStatementUpload(body) {
  return apiPost('/api/v1/bank-statements/upload', body, { timeout: 60000 });
}

export async function bankStatementSuggestHeaderMetadata(companyId, raw) {
  const slice = Array.isArray(raw) ? raw.slice(0, 24) : [];
  return apiPost(
    '/api/v1/bank-statements/suggest-header-metadata',
    { companyId, raw: slice },
    { timeout: 45000 },
  );
}
export async function bankStatementConfirmMapping(id, body) {
  return apiPatch(`/api/v1/bank-statements/${id}/confirm-mapping`, body);
}
export async function bankStatementsList(companyId, params = {}) {
  const res = await apiGet('/api/v1/bank-statements', { companyId, ...params });
  return res.success ? { success: true, data: res.data ?? [] } : res;
}
export async function bankStatementSummary(companyId) {
  const res = await apiGet('/api/v1/bank-statements/summary', { companyId });
  return res;
}
export async function bankStatementGet(companyId, id) {
  return apiGet(`/api/v1/bank-statements/${id}`, { companyId });
}
export async function bankStatementUpdateTxCategory(statementId, txId, companyId, categoryId) {
  return apiPatch(`/api/v1/bank-statements/${statementId}/transactions/${txId}/category`, { companyId, categoryId });
}
export async function bankStatementUpdateTxNote(statementId, txId, companyId, note) {
  return apiPatch(`/api/v1/bank-statements/${statementId}/transactions/${txId}/note`, { companyId, note });
}
export async function bankStatementDelete(companyId, id) {
  return apiDelete(`/api/v1/bank-statements/${id}?companyId=${companyId}`);
}
export async function bankStatementCategories(companyId) {
  const res = await apiGet('/api/v1/bank-statements/categories', { companyId });
  return res.success ? { success: true, data: res.data ?? [] } : res;
}
export async function bankStatementCreateCategory(body) {
  return apiPost('/api/v1/bank-statements/categories', body);
}
export async function bankStatementDeleteCategory(companyId, id) {
  return apiDelete(`/api/v1/bank-statements/categories/${id}?companyId=${companyId}`);
}

export async function bankStatementReclassify(companyId, statementId) {
  return apiPost(`/api/v1/bank-statements/${statementId}/reclassify`, { companyId }, { timeout: 120000 });
}

export async function bankStatementReconciliationStats(companyId, startDate, endDate) {
  return apiGet('/api/v1/bank-statements/reconciliation-stats', {
    companyId,
    startDate: String(startDate || '').slice(0, 10),
    endDate: String(endDate || '').slice(0, 10),
  });
}

export async function bankStatementTemplatesList(companyId) {
  const res = await apiGet('/api/v1/bank-statements/templates', { companyId });
  return res.success ? { success: true, data: res.data ?? [] } : res;
}

export async function bankStatementTemplateSetActive(companyId, templateId, isActive) {
  return apiPatch(`/api/v1/bank-statements/templates/${templateId}`, { companyId, isActive });
}

/** حذف القالب نهائياً (مطابق Base44) */
export async function bankStatementTemplateDelete(companyId, templateId) {
  return apiDelete(`/api/v1/bank-statements/templates/${templateId}?companyId=${companyId}`);
}

export async function bankStatementTreeCategoriesList(companyId) {
  const res = await apiGet('/api/v1/bank-statements/tree-categories', { companyId });
  return res.success ? { success: true, data: res.data ?? [] } : res;
}

export async function bankStatementTreeCategoryCreate(body) {
  return apiPost('/api/v1/bank-statements/tree-categories', body);
}

export async function bankStatementTreeCategoryUpdate(companyId, categoryId, patch) {
  return apiPatch(`/api/v1/bank-statements/tree-categories/${categoryId}`, { companyId, ...patch });
}

export async function bankStatementTreeCategoryDelete(companyId, categoryId) {
  return apiDelete(`/api/v1/bank-statements/tree-categories/${categoryId}?companyId=${companyId}`);
}

/** استيراد 8 فئات التصنيف الافتراضية — فقط إذا كانت القائمة فارغة */
export async function bankStatementTreeCategoriesSeedDefaults(companyId) {
  return apiPost('/api/v1/bank-statements/tree-categories/seed-defaults', { companyId });
}

export async function bankStatementClassificationRulesList(companyId) {
  const res = await apiGet('/api/v1/bank-statements/classification-rules', { companyId });
  return res.success ? { success: true, data: res.data ?? [] } : res;
}

export async function bankStatementClassificationRuleCreate(body) {
  return apiPost('/api/v1/bank-statements/classification-rules', body);
}

export async function bankStatementClassificationRuleDelete(companyId, ruleId) {
  return apiDelete(`/api/v1/bank-statements/classification-rules/${ruleId}?companyId=${companyId}`);
}

/** تصدير حزمة قواعد التصنيف (فئات شجرية + قواعد مسطّحة) — JSON */
export async function bankStatementClassificationRulesExportPack(companyId) {
  const res = await apiGet('/api/v1/bank-statements/classification-rules/export-pack', { companyId });
  if (!res.success) return res;
  return { success: true, data: res.data };
}

/** استيراد حزمة من ملف JSON — mode: merge | replace */
export async function bankStatementClassificationRulesImportPack(companyId, pack, mode = 'merge') {
  return apiPost('/api/v1/bank-statements/classification-rules/import-pack', {
    companyId,
    mode,
    pack,
  });
}

/** نسخ القواعد من شركة أخرى في نفس المستأجر — mode: merge | replace */
export async function bankStatementClassificationRulesImportFromCompany(companyId, sourceCompanyId, mode = 'merge') {
  return apiPost('/api/v1/bank-statements/classification-rules/import-from-company', {
    companyId,
    sourceCompanyId,
    mode,
  });
}

// ——— موارد ———

export async function getCompanies(includeArchived = false) {
  return apiGet('/api/v1/companies', includeArchived ? { includeArchived: 'true' } : {});
}

export async function getCompany(id) {
  if (!id) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiGet(`/api/v1/companies/${id}`);
}

export async function getRoles() {
  const res = await apiGet('/api/v1/roles');
  return { success: res.success, data: Array.isArray(res.data) ? res.data : [] };
}

export async function createRole(body) { return apiPost('/api/v1/roles', body); }
export async function updateRole(id, body) { return apiPatch(`/api/v1/roles/${id}`, body); }
export async function deleteRole(id) { return apiDelete(`/api/v1/roles/${id}`); }

export async function getUsers() {
  const res = await apiGet('/api/v1/users');
  if (!res.success) return { success: false, error: res.error, data: [] };
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}
export async function createUser(body) { return apiPost('/api/v1/users', body); }
export async function updateUser(id, body) { return apiPatch(`/api/v1/users/${id}`, body); }
export async function archiveUser(id) { return apiPatch(`/api/v1/users/${id}/archive`, {}); }
export async function restoreUser(id) { return apiPatch(`/api/v1/users/${id}/restore`, {}); }
export async function deleteUser(id) { return apiDelete(`/api/v1/users/${id}`); }

export async function createCompany(body) { return apiPost('/api/v1/companies', body); }
export async function updateCompany(id, body) {
  if (!id) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiPatch(`/api/v1/companies/${id}`, body);
}
export async function deleteCompany(id) {
  if (!id) return { success: false, error: 'معرف الشركة مطلوب' };
  return apiDelete(`/api/v1/companies/${id}`);
}

export async function getLedgerEntries(companyId, fromDate, toDate, page = 1, pageSize = 50, q) {
  const params = { companyId, fromDate, toDate, page, pageSize };
  if (q && String(q).trim()) params.q = String(q).trim();
  return apiGet('/api/v1/ledger', params);
}

// ——— الحسابات والفئات ———
export async function getAccounts(companyId) {
  const res = await apiGet('/api/v1/accounts', { companyId });
  return res.success && Array.isArray(res.data) ? res : { success: true, data: [] };
}
export async function getCategories(companyId) {
  return apiGet('/api/v1/categories', { companyId });
}
export async function createCategory(body) { return apiPost('/api/v1/categories', body); }
export async function updateCategory(id, body) { return apiPatch(`/api/v1/categories/${id}`, body); }
export async function deleteCategory(id, companyId) {
  return apiDelete(`/api/v1/categories/${id}?companyId=${companyId}`);
}

// ——— بنود المصاريف (ثابت/متغير) ———
export async function getExpenseLines(companyId, kind, includeInactive = false) {
  const params = { companyId };
  if (kind) params.kind = kind;
  if (includeInactive) params.includeInactive = 'true';
  const res = await apiGet('/api/v1/expense-lines', params);
  return res.success && Array.isArray(res.data) ? res : { success: true, data: [] };
}
export async function getExpenseLine(id, companyId) {
  return apiGet(`/api/v1/expense-lines/${id}`, { companyId });
}
export async function getExpenseLinePayments(id, companyId, startDate, endDate, page = 1, pageSize = 50) {
  const params = { companyId, page: String(page), pageSize: String(pageSize) };
  if (startDate) params.startDate = String(startDate).slice(0, 10);
  if (endDate) params.endDate = String(endDate).slice(0, 10);
  return apiGet(`/api/v1/expense-lines/${id}/payments`, params);
}
export async function createExpenseLine(body) {
  return apiPost('/api/v1/expense-lines', body);
}
export async function updateExpenseLine(id, body, companyId) {
  return apiPatch(`/api/v1/expense-lines/${id}?companyId=${companyId}`, body);
}
export async function deactivateExpenseLine(id, companyId) {
  return apiPatch(`/api/v1/expense-lines/${id}/deactivate?companyId=${companyId}`, {});
}

// ——— ملخصات المبيعات اليومية ———
export async function createDailySalesSummary(body) { return apiPost('/api/v1/sales/summary', body); }
export async function updateDailySalesSummary(id, body, companyId) {
  return apiPatch(`/api/v1/sales/summaries/${id}?companyId=${companyId}`, body);
}
export async function cancelDailySalesSummary(id, companyId) {
  return apiDelete(`/api/v1/sales/summaries/${id}?companyId=${companyId}`);
}
export async function getDailySalesSummaries(
  companyId,
  startDate,
  endDate,
  page = 1,
  pageSize = 50,
  q,
  sortBy,
  sortDir,
  includeCancelled,
) {
  const size = Math.min(200, Math.max(1, Number(pageSize) || 50));
  const params = { companyId, page: String(page), pageSize: String(size) };
  if (startDate) params.startDate = String(startDate).slice(0, 10);
  if (endDate) params.endDate = String(endDate).slice(0, 10);
  if (q && String(q).trim()) params.q = String(q).trim();
  if (sortBy) params.sortBy = sortBy;
  if (sortDir) params.sortDir = sortDir;
  if (includeCancelled) params.includeCancelled = '1';
  const res = await apiGet('/api/v1/sales/summaries', params);
  if (!res.success) return res;
  const raw = res.data?.data ?? res.data;
  const items = raw?.items ?? (Array.isArray(raw) ? raw : []);
  const total = Number(raw?.total ?? items.length) || 0;
  return {
    success: true,
    data: {
      items,
      total,
      page: Number(raw?.page) || page,
      pageSize: Number(raw?.pageSize) || size,
    },
  };
}

/** جلب كل ملخصات المبيعات في الفترة (مع إلغاء الملخصات) — للتصدير والطباعة */
export async function fetchAllSalesSummariesForExport(
  companyId,
  startDate,
  endDate,
  q,
  sortBy = 'transactionDate',
  sortDir = 'desc',
) {
  const pageSize = 150;
  let page = 1;
  const acc = [];
  for (let guard = 0; guard < 500; guard++) {
    const res = await getDailySalesSummaries(
      companyId,
      startDate,
      endDate,
      page,
      pageSize,
      q,
      sortBy,
      sortDir,
      true,
    );
    if (!res?.success) break;
    const { items = [], total = 0 } = res.data || {};
    acc.push(...items);
    const t = Number(total) || 0;
    if (acc.length >= t || items.length < pageSize) break;
    page += 1;
  }
  return acc;
}

/** ملخص دفعات المشتريات في الفترة — من السيرفر (بدل صفحة فواتير واحدة) */
export async function getPurchaseBatchSummaries(companyId, startDate, endDate, q) {
  const params = { companyId };
  if (startDate) params.startDate = String(startDate).slice(0, 10);
  if (endDate) params.endDate = String(endDate).slice(0, 10);
  if (q && String(q).trim()) params.q = String(q).trim();
  const res = await apiGet('/api/v1/invoices/purchase-batch-summaries', params);
  if (!res.success) return { success: false, error: res.error, data: { batches: [], rowCount: 0 } };
  const raw = res.data?.data ?? res.data;
  return {
    success: true,
    data: {
      batches: Array.isArray(raw?.batches) ? raw.batches : [],
      rowCount: Number(raw?.rowCount) || 0,
    },
  };
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
    if (!res.success) throw new Error(res.error || 'فشل تحميل فواتير الدفعة');
    const items = res.data?.items ?? [];
    total = Number(res.data?.total) ?? all.length + items.length;
    all.push(...items);
    if (!items.length || items.length < pageSize) break;
    page += 1;
  }
  return all;
}

// ——— التقارير ———
export async function getGeneralProfitLossReport(companyId, year) {
  return apiGet('/api/v1/reports/general-profit-loss', { companyId, year: String(year) });
}
export async function getGeneralProfitLossDetails(companyId, year, month, groupKey, itemKey) {
  const params = { companyId, year: String(year), groupKey };
  if (month != null && month !== '') params.month = String(month);
  if (itemKey) params.itemKey = itemKey;
  return apiGet('/api/v1/reports/general-profit-loss/details', params);
}
export async function getGeneralProfitLossTrend(companyId, year, groupKey, itemKey) {
  const params = { companyId, year: String(year), groupKey };
  if (itemKey) params.itemKey = itemKey;
  return apiGet('/api/v1/reports/general-profit-loss/trend', params);
}

export async function getTaxVatReport(companyId, year, period) {
  return apiGet('/api/v1/reports/tax-vat', { companyId, year: String(year), period });
}

/** تحليل فترة: إجماليات حسب نوع الفاتورة + أعلى موردين — يتطلب REPORTS_READ */
export async function getPeriodAnalytics(companyId, startDate, endDate) {
  const params = {
    companyId,
    startDate: String(startDate || '').slice(0, 10),
    endDate: String(endDate || '').slice(0, 10),
  };
  const res = await apiGet('/api/v1/reports/period-analytics', params);
  if (!res.success) return res;
  const raw = res.data?.data ?? res.data;
  return { success: true, data: raw };
}

// ——— الطلبات ———
export async function getOrders(companyId, year, month) {
  const res = await apiGet('/api/v1/orders', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function createOrder(body) {
  return apiPost('/api/v1/orders', body);
}
export async function updateOrder(id, body, companyId) {
  return apiPatch(`/api/v1/orders/${id}?companyId=${companyId}`, body);
}
export async function cancelOrder(id, companyId) {
  return apiDelete(`/api/v1/orders/${id}?companyId=${companyId}`);
}
export async function getOrdersSummary(companyId, year, month) {
  const res = await apiGet('/api/v1/orders/summary', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? {} } : { success: false, data: {} };
}
export async function getProductPurchaseHistory(companyId, productId, year, month) {
  const params = { companyId };
  if (year) params.year = String(year);
  if (month) params.month = String(month);
  const res = await apiGet(`/api/v1/orders/product-history/${productId}`, params);
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function getCategoryPurchaseHistory(companyId, categoryId, year, month) {
  const params = { companyId };
  if (year) params.year = String(year);
  if (month) params.month = String(month);
  const res = await apiGet(`/api/v1/orders/category-history/${categoryId}`, params);
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function getOrdersItemsReport(companyId, year, month) {
  const res = await apiGet('/api/v1/orders/items-report', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function getOrderProducts(companyId) {
  const res = await apiGet('/api/v1/orders/products', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function createOrderProduct(body) {
  return apiPost('/api/v1/orders/products', body);
}
export async function createOrderProductsBatch(companyId, products) {
  return apiPost('/api/v1/orders/products/batch', { companyId, products }, { timeout: 90000 });
}
export async function createOrderCategoriesBatch(companyId, categories) {
  return apiPost('/api/v1/orders/categories/batch', { companyId, categories }, { timeout: 60000 });
}
export async function updateOrderProduct(id, body, companyId) {
  return apiPatch(`/api/v1/orders/products/${id}?companyId=${companyId}`, body);
}
export async function getOrderCategories(companyId) {
  const res = await apiGet('/api/v1/orders/categories', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function createOrderCategory(body) {
  return apiPost('/api/v1/orders/categories', body);
}
export async function updateOrderCategory(id, body, companyId) {
  return apiPatch(`/api/v1/orders/categories/${id}?companyId=${companyId}`, body);
}

// ——— الخزائن ———
export async function getVaults(companyId, includeArchived = false, startDate, endDate) {
  const params = { companyId, ...(includeArchived ? { includeArchived: 'true' } : {}) };
  if (startDate) params.startDate = String(startDate).slice(0, 25);
  if (endDate) params.endDate = String(endDate).slice(0, 25);
  return apiGet('/api/v1/vaults', params);
}
export async function getVaultTransactions(vaultId, companyId, startDate, endDate, page = 1, pageSize = 50) {
  const params = { companyId, page: String(page), pageSize: String(pageSize) };
  if (startDate) params.startDate = startDate;
  if (endDate)   params.endDate   = endDate;
  return apiGet(`/api/v1/vaults/${vaultId}/transactions`, params);
}
export async function updateVault(id, body) { return apiPatch(`/api/v1/vaults/${id}`, body); }
export async function archiveVault(id) { return apiPatch(`/api/v1/vaults/${id}/archive`, {}); }
export async function deleteVault(id) { return apiDelete(`/api/v1/vaults/${id}`); }
export async function createVault(body) { return apiPost('/api/v1/vaults', body); }

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

// ——— HR: مسيرات الرواتب، الإجازات، الإقامات، المستندات ———
export async function getPayrollRuns(companyId, year) {
  const params = { companyId };
  if (year) params.year = String(year);
  return apiGet('/api/v1/hr/payroll-runs', params);
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

export async function getHrAdvances(companyId, year) {
  const params = { companyId };
  if (year != null) params.year = String(year);
  return apiGet('/api/v1/hr/advances', params);
}

export async function getLeaves(companyId, employeeId, year) {
  const params = { companyId };
  if (employeeId) params.employeeId = employeeId;
  if (year) params.year = String(year);
  return apiGet('/api/v1/hr/leaves', params);
}
export async function createLeave(body) {
  return apiPost('/api/v1/hr/leaves', body);
}
export async function updateLeaveStatus(id, companyId, status) {
  return apiPatch(`/api/v1/hr/leaves/${id}/status?companyId=${companyId}`, { status });
}

export async function getResidencies(companyId, employeeId) {
  const params = { companyId };
  if (employeeId) params.employeeId = employeeId;
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

export async function getDocuments(companyId, employeeId) {
  const params = { companyId };
  if (employeeId) params.employeeId = employeeId;
  return apiGet('/api/v1/hr/documents', params);
}
export async function createDocument(body) {
  return apiPost('/api/v1/hr/documents', body);
}
export async function uploadDocument(formData) {
  const url = new URL('/api/v1/hr/documents/upload', getBase());
  const token = getAuthToken();
  const companyId = getActiveCompanyId();
  const h = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (companyId) h['x-company-id'] = String(companyId);
  try {
    const res = await safeFetch(url.toString(), { method: 'POST', headers: h, body: formData });
    return parseResponse(res);
  } catch (err) {
    return { success: false, error: err?.message || 'خطأ في الاتصال', isNetworkError: true };
  }
}

export async function uploadDocumentFile({ companyId, employeeId, documentType, file }) {
  const url = new URL('/api/v1/hr/documents/upload-file', getBase());
  const formData = new FormData();
  formData.append('file', file);
  formData.append('companyId', companyId);
  formData.append('employeeId', employeeId);
  formData.append('documentType', documentType || 'other');
  const h = {};
  const token = getAuthToken();
  const cid = getActiveCompanyId();
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (cid) h['x-company-id'] = String(cid);
  try {
    const res = await safeFetch(url.toString(), { method: 'POST', headers: h, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data?.message || data?.error || res.statusText };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err?.message || 'خطأ في الاتصال', isNetworkError: true };
  }
}
export async function downloadDocument(id, companyId) {
  const url = new URL(`/api/v1/hr/documents/${id}/download`, getBase());
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

export async function getMovements(companyId, employeeId) {
  const params = { companyId };
  if (employeeId) params.employeeId = employeeId;
  return apiGet('/api/v1/hr/movements', params);
}
export async function createMovement(body) {
  return apiPost('/api/v1/hr/movements', body);
}

export async function getCustomAllowances(companyId, employeeId) {
  const params = { companyId };
  if (employeeId) params.employeeId = employeeId;
  return apiGet('/api/v1/hr/allowances', params);
}
export async function createCustomAllowance(body) {
  return apiPost('/api/v1/hr/allowances', body);
}
export async function deleteCustomAllowance(id, companyId) {
  return apiDelete(`/api/v1/hr/allowances/${id}?companyId=${companyId}`);
}

export async function getDeductions(companyId, employeeId) {
  const params = { companyId };
  if (employeeId) params.employeeId = employeeId;
  return apiGet('/api/v1/hr/deductions', params);
}
export async function createDeduction(body) {
  return apiPost('/api/v1/hr/deductions', body);
}

// ——— الموردون ———
export async function getSuppliers(companyId, page = 1, pageSize = 50, q) {
  const params = { companyId, page, pageSize };
  if (q && String(q).trim()) params.q = String(q).trim();
  return apiGet('/api/v1/suppliers', params);
}
export async function createSupplier(body) { return apiPost('/api/v1/suppliers', body); }
export async function updateSupplier(id, body) { return apiPatch(`/api/v1/suppliers/${id}`, body); }
export async function deleteSupplier(id) { return apiDelete(`/api/v1/suppliers/${id}`); }

// ——— الفواتير ———
export async function createInvoice(body) { return apiPost('/api/v1/invoices', body); }
export async function createInvoiceBatch(body) { return apiPost('/api/v1/invoices/batch', body); }
export async function updateInvoice(id, body, companyId) {
  return apiPatch(`/api/v1/invoices/${id}?companyId=${companyId}`, body);
}
export async function getInvoices(companyId, startDate, endDate, page = 1, pageSize = 50, batchId, employeeId, kind, sortBy, sortDir, supplierId, q, categoryId, expenseLineId) {
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
  if (q && String(q).trim()) params.q = String(q).trim();
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
    const url = new URL(`/api/v1/backup/jobs/${encodeURIComponent(jobId)}/download`, getBase());
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
