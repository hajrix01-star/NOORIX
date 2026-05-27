import { setRefreshToken } from '../../authStore';
import type { ApiParsedResult, AuthLoginRefreshPayload } from '../../../types/api';
import { toYmd } from '../../../utils/saudiDate';
import { apiGet, apiPost, apiPatch, apiDelete, getApiBaseUrl, getAuthHeaders } from '../../core/apiHttp';

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? '');
}

type JsonRecord = Record<string, unknown>;

// ——— فحص الاتصال ———
export async function checkApiConnection(): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const base = getApiBaseUrl();
    // liveness فقط — لا يعتمد على DB (readiness /health قد يعطي 503 والعملية شغّالة)
    const url = base ? `${base}/api/v1/health/live` : '/api/v1/health/live';
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal }).catch(() => null);
    clearTimeout(tid);
    if (!res) return { ok: false, error: 'السيرفر غير متاح' };
    return { ok: res.status === 200, status: res.status };
  } catch (err: unknown) {
    return { ok: false, error: errMsg(err) };
  }
}

/** جلب حالة الصحة الكاملة (يتضمن geminiAvailable) */
export async function getHealth(): Promise<ApiParsedResult> {
  try {
    const base = getApiBaseUrl();
    const url = base ? `${base}/api/v1/health` : '/api/v1/health';
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { method: 'GET', headers: getAuthHeaders(), signal: ctrl.signal }).catch(() => null);
    clearTimeout(tid);
    if (!res) return { success: false, error: 'السيرفر غير متاح', isNetworkError: true };
    const data = (await res.json().catch(() => ({}))) as JsonRecord;
    if (!res.ok) return { success: false, error: String(data?.message ?? res.statusText), code: res.status };
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'خطأ في الاتصال', isNetworkError: true };
  }
}

/** اختبار Gemini مباشرة — للتشخيص */
export async function testGemini(_variables?: unknown): Promise<ApiParsedResult> {
  return apiGet('/api/v1/gemini-test');
}

/**
 * تسجيل الدخول — إرجاع { access_token, refresh_token, user }.
 */
export async function login(email: string, password: string): Promise<ApiParsedResult> {
  const res = await apiPost('/api/v1/auth/login', { email, password });
  if (!res.success) return res;
  const data = res.data as AuthLoginRefreshPayload | undefined;
  if (data?.refresh_token) {
    setRefreshToken(data.refresh_token);
  }
  return { success: true, data };
}

/**
 * المستخدم الحالي — يتطلب JWT.
 */
export async function getMe(): Promise<ApiParsedResult> {
  return apiGet('/api/v1/auth/me');
}

/**
 * تغيير كلمة المرور — يتطلب JWT.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<ApiParsedResult> {
  const res = await apiPost('/api/v1/auth/change-password', { currentPassword, newPassword });
  return res;
}

/**
 * المحادثة الذكية — إرسال استعلام والحصول على إجابة.
 */
export async function chatQuery(query: string): Promise<ApiParsedResult> {
  return apiPost('/api/v1/chat/query', { query });
}

/** تحليل كشوف الحساب */
export async function bankStatementUpload(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/bank-statements/upload', body, { timeout: 60000 });
}

export async function bankStatementSuggestHeaderMetadata(
  companyId: string,
  raw: unknown,
): Promise<ApiParsedResult> {
  const slice = Array.isArray(raw) ? raw.slice(0, 24) : [];
  return apiPost(
    '/api/v1/bank-statements/suggest-header-metadata',
    { companyId, raw: slice },
    { timeout: 45000 },
  );
}
export async function bankStatementConfirmMapping(id: string, body: unknown): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/bank-statements/${id}/confirm-mapping`, body);
}
export async function bankStatementsList(
  companyId: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/bank-statements', { companyId, ...params });
  return res.success ? { success: true, data: res.data ?? [] } : res;
}
export async function bankStatementSummary(companyId: string): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/bank-statements/summary', { companyId });
  return res;
}
export async function bankStatementGet(companyId: string, id: string): Promise<ApiParsedResult> {
  return apiGet(`/api/v1/bank-statements/${id}`, { companyId });
}
export async function bankStatementUpdateTxCategory(
  statementId: string,
  txId: string,
  companyId: string,
  categoryId: string,
): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/bank-statements/${statementId}/transactions/${txId}/category`, { companyId, categoryId });
}
export async function bankStatementUpdateTxNote(
  statementId: string,
  txId: string,
  companyId: string,
  note: string,
): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/bank-statements/${statementId}/transactions/${txId}/note`, { companyId, note });
}
export async function bankStatementDelete(companyId: string, id: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/bank-statements/${id}?companyId=${companyId}`);
}
export async function bankStatementCategories(companyId: string): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/bank-statements/categories', { companyId });
  return res.success ? { success: true, data: res.data ?? [] } : res;
}
export async function bankStatementCreateCategory(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/bank-statements/categories', body);
}
export async function bankStatementDeleteCategory(companyId: string, id: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/bank-statements/categories/${id}?companyId=${companyId}`);
}

export async function bankStatementReclassify(companyId: string, statementId: string): Promise<ApiParsedResult> {
  return apiPost(`/api/v1/bank-statements/${statementId}/reclassify`, { companyId }, { timeout: 120000 });
}

export async function bankStatementReconciliationStats(
  companyId: string,
  startDate: unknown,
  endDate: unknown,
): Promise<ApiParsedResult> {
  return apiGet('/api/v1/bank-statements/reconciliation-stats', {
    companyId,
    startDate: toYmd(startDate),
    endDate: toYmd(endDate),
  });
}

export async function bankStatementTemplatesList(companyId: string): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/bank-statements/templates', { companyId });
  return res.success ? { success: true, data: res.data ?? [] } : res;
}

export async function bankStatementTemplateSetActive(
  companyId: string,
  templateId: string,
  isActive: boolean,
): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/bank-statements/templates/${templateId}`, { companyId, isActive });
}

/** حذف القالب نهائياً (مطابق Base44) */
export async function bankStatementTemplateDelete(companyId: string, templateId: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/bank-statements/templates/${templateId}?companyId=${companyId}`);
}

export async function bankStatementTreeCategoriesList(companyId: string): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/bank-statements/tree-categories', { companyId });
  return res.success ? { success: true, data: res.data ?? [] } : res;
}

export async function bankStatementTreeCategoryCreate(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/bank-statements/tree-categories', body);
}

export async function bankStatementTreeCategoryUpdate(
  companyId: string,
  categoryId: string,
  patch: JsonRecord,
): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/bank-statements/tree-categories/${categoryId}`, { companyId, ...patch });
}

export async function bankStatementTreeCategoryDelete(companyId: string, categoryId: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/bank-statements/tree-categories/${categoryId}?companyId=${companyId}`);
}

/** استيراد 8 فئات التصنيف الافتراضية — فقط إذا كانت القائمة فارغة */
export async function bankStatementTreeCategoriesSeedDefaults(companyId: string): Promise<ApiParsedResult> {
  return apiPost('/api/v1/bank-statements/tree-categories/seed-defaults', { companyId });
}

export async function bankStatementClassificationRulesList(companyId: string): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/bank-statements/classification-rules', { companyId });
  return res.success ? { success: true, data: res.data ?? [] } : res;
}

export async function bankStatementClassificationRuleCreate(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/bank-statements/classification-rules', body);
}

export async function bankStatementClassificationRuleDelete(companyId: string, ruleId: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/bank-statements/classification-rules/${ruleId}?companyId=${companyId}`);
}

/** تصدير حزمة قواعد التصنيف (فئات شجرية + قواعد مسطّحة) — JSON */
export async function bankStatementClassificationRulesExportPack(companyId: string): Promise<ApiParsedResult> {
  const res = await apiGet('/api/v1/bank-statements/classification-rules/export-pack', { companyId });
  if (!res.success) return res;
  return { success: true, data: res.data };
}

/** استيراد حزمة من ملف JSON — mode: merge | replace */
export async function bankStatementClassificationRulesImportPack(
  companyId: string,
  pack: unknown,
  mode: 'merge' | 'replace' = 'merge',
): Promise<ApiParsedResult> {
  return apiPost('/api/v1/bank-statements/classification-rules/import-pack', {
    companyId,
    mode,
    pack,
  });
}

/** نسخ القواعد من شركة أخرى في نفس المستأجر — mode: merge | replace */
export async function bankStatementClassificationRulesImportFromCompany(
  companyId: string,
  sourceCompanyId: string,
  mode: 'merge' | 'replace' = 'merge',
): Promise<ApiParsedResult> {
  return apiPost('/api/v1/bank-statements/classification-rules/import-from-company', {
    companyId,
    sourceCompanyId,
    mode,
  });
}
