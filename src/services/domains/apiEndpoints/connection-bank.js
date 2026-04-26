import { setRefreshToken } from '../../authStore';
import { apiGet, apiPost, apiPatch, apiDelete, getApiBaseUrl, getAuthHeaders } from '../../core/apiHttp';

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
