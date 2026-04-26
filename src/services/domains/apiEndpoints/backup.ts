import { getAuthToken } from '../../authStore';
import {
  apiGet,
  apiPost,
  apiPatch,
  safeFetch,
  parseResponse,
  getApiBaseUrl,
  getAuthHeaders,
  handleUnauthorized,
} from '../../core/apiHttp';

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
export async function backupDownloadJobFile(jobId: string, suggestedName?: string) {
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
