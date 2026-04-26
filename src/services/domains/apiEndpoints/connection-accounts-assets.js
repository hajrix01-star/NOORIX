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

// ——— فحص الاتصال ———
export async function checkApiConnection() {
  try {
    const base = getApiBaseUrl();
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
    const base = getApiBaseUrl();
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

/** إعادة تهيئة فئات شركة واحدة — super_admin فقط */
export async function resetCompanyCategories(companyId) {
  return apiPost(`/api/v1/accounting-init/reset-categories/${companyId}`, {});
}

/** إعادة تهيئة فئات جميع الشركات — super_admin فقط */
export async function resetAllCompaniesCategories() {
  return apiPost('/api/v1/accounting-init/reset-all-categories', {});
}

/** إضافة الفئات الناقصة فقط لشركة — بدون حذف أي فئة موجودة */
export async function patchCompanyCategories(companyId) {
  return apiPost(`/api/v1/accounting-init/patch-categories/${companyId}`, {});
}

/** إضافة الفئات الناقصة لجميع الشركات — بدون حذف */
export async function patchAllCompaniesCategories() {
  return apiPost('/api/v1/accounting-init/patch-all-categories', {});
}

export async function getRoles() {
  const res = await apiGet('/api/v1/roles');
  return { success: res.success, data: Array.isArray(res.data) ? res.data : [] };
}

export async function getPermissionsSchema() {
  return apiGet('/api/v1/roles/permissions-schema');
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

// ——— سجل الأصول (ضمان، مدة) ———
export async function getCompanyAssets(companyId, { warrantyFilter, q, page = 1, pageSize = 50 } = {}) {
  const params = { companyId, page: String(page), pageSize: String(pageSize) };
  if (warrantyFilter) params.warrantyFilter = warrantyFilter;
  if (q && String(q).trim()) params.q = String(q).trim();
  return apiGet('/api/v1/company-assets', params);
}
export async function getCompanyAsset(id, companyId) {
  return apiGet(`/api/v1/company-assets/${id}`, { companyId });
}
export async function createCompanyAsset(body) {
  return apiPost('/api/v1/company-assets', body);
}
export async function updateCompanyAsset(id, companyId, body) {
  return apiPatch(`/api/v1/company-assets/${id}?companyId=${companyId}`, body);
}
export async function deleteCompanyAsset(id, companyId) {
  return apiDelete(`/api/v1/company-assets/${id}?companyId=${companyId}`);
}
export async function getPendingWarrantyInvoices(companyId) {
  return apiGet('/api/v1/company-assets/pending-invoices', { companyId });
}
export async function completeCompanyAssetFromInvoice(body) {
  return apiPost('/api/v1/company-assets/complete-from-invoice', body);
}

