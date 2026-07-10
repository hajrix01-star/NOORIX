import { getAuthToken } from '../../authStore';
import type { ApiParsedResult } from '../../../types/api';
import type {
  BackupConfigData,
  BackupImportReport,
  BackupJob,
  BackupReportPayload,
  BackupRestoreVariables,
  BackupSchedulePatch,
} from '../../../modules/Settings/settingsTypes';
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

type BackupDownloadResult = { success: boolean; error?: string };
type BackupUploadResult = { status?: string | null };
type BackupRestoreResult = {
  messageAr?: string | null;
  messageEn?: string | null;
};

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? '');
}

async function downloadBackupBlob({
  path,
  fallbackName,
  timeout = 180000,
}: {
  path: string;
  fallbackName: string;
  timeout?: number;
}): Promise<BackupDownloadResult> {
  try {
    const url = new URL(path, getApiBaseUrl());
    const res = await safeFetch(url.toString(), { method: 'GET', headers: getAuthHeaders() }, timeout);
    if (res.status === 401) {
      handleUnauthorized();
      return { success: false, error: 'غير مصرح' };
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || res.statusText };
    }
    const blob = await res.blob();
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = fallbackName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(anchor.href);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'فشل التنزيل' };
  }
}

function authHeaders() {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function uploadBackupForm(path: string, formData: FormData): Promise<ApiParsedResult<BackupUploadResult | BackupRestoreResult>> {
  const url = new URL(path, getApiBaseUrl());
  try {
    const res = await safeFetch(url.toString(), { method: 'POST', headers: authHeaders(), body: formData }, 600000);
    return parseResponse(res);
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'خطأ في الاتصال', isNetworkError: true };
  }
}

export async function backupTriggerCompany(companyId: string): Promise<ApiParsedResult<BackupJob>> {
  return apiPost('/api/v1/backup/trigger', { scope: 'company', companyId }, { timeout: 180000 });
}

export async function backupListJobs(limit = 40): Promise<ApiParsedResult<BackupJob[]>> {
  return apiGet('/api/v1/backup/jobs', { limit: String(limit) });
}

export async function backupRestoreReport(jobId: string): Promise<ApiParsedResult<BackupReportPayload>> {
  return apiGet(`/api/v1/backup/jobs/${encodeURIComponent(jobId)}/restore-report`);
}

export async function backupRetryExternal(jobId: string): Promise<ApiParsedResult<BackupJob>> {
  return apiPost(`/api/v1/backup/jobs/${encodeURIComponent(jobId)}/retry-external`, {}, { timeout: 120000 });
}

export async function backupDownloadJobFile(
  jobId: string,
  suggestedName?: string,
): Promise<BackupDownloadResult> {
  return downloadBackupBlob({
    path: `/api/v1/backup/jobs/${encodeURIComponent(jobId)}/download`,
    fallbackName: suggestedName || `noorix-backup-${jobId}.json.gz`,
  });
}

export async function backupImportFromJob(body: unknown): Promise<ApiParsedResult<BackupImportReport>> {
  return apiPost('/api/v1/backup/import', body, { timeout: 600000 });
}

export async function backupGetSystemConfig(): Promise<ApiParsedResult<BackupConfigData>> {
  return apiGet('/api/v1/backup/system/config');
}

export async function backupPatchSystemConfig(body: BackupSchedulePatch): Promise<ApiParsedResult<BackupConfigData>> {
  return apiPatch('/api/v1/backup/system/config', body);
}

export async function backupListSystemJobs(limit = 20): Promise<ApiParsedResult<BackupJob[]>> {
  return apiGet('/api/v1/backup/system/jobs', { limit: String(limit) });
}

export async function backupRunSystemNow(): Promise<ApiParsedResult<BackupJob>> {
  return apiPost('/api/v1/backup/system/run-full-archive', {}, { timeout: 600000 });
}

export async function backupRunSystemFullArchive(): Promise<ApiParsedResult<BackupJob>> {
  return apiPost('/api/v1/backup/system/run-full-archive', {}, { timeout: 600000 });
}

export async function backupVerifySystemJob(jobId: string): Promise<ApiParsedResult<BackupJob>> {
  return apiPost(`/api/v1/backup/system/jobs/${encodeURIComponent(jobId)}/verify`, {}, { timeout: 180000 });
}

export async function backupVerifyCompanyJob(jobId: string): Promise<ApiParsedResult<BackupJob>> {
  return apiPost(`/api/v1/backup/jobs/${encodeURIComponent(jobId)}/verify`, {}, { timeout: 180000 });
}

export async function backupGetCompanyConfig(companyId: string): Promise<ApiParsedResult<BackupConfigData>> {
  return apiGet('/api/v1/backup/company/config', { companyId });
}

export async function backupPatchCompanyConfig(body: BackupSchedulePatch & { companyId: string }): Promise<ApiParsedResult<BackupConfigData>> {
  return apiPatch('/api/v1/backup/company/config', body);
}

export async function backupRestoreSystemFull(
  jobId: string,
  confirmPhrase: string,
): Promise<ApiParsedResult<BackupRestoreResult>> {
  return apiPost(
    `/api/v1/backup/system/jobs/${encodeURIComponent(jobId)}/restore`,
    { confirmPhrase },
    { timeout: 600000 },
  );
}

export async function backupDownloadSystemJobFile(
  jobId: string,
  suggestedName?: string,
): Promise<BackupDownloadResult> {
  return downloadBackupBlob({
    path: `/api/v1/backup/system/jobs/${encodeURIComponent(jobId)}/download`,
    fallbackName: suggestedName || `noorix-full-db-${jobId}.dump.gz`,
  });
}

export async function backupUploadSystemFullArchive(file: File | null | undefined): Promise<ApiParsedResult<BackupUploadResult | BackupRestoreResult>> {
  if (!file) return { success: false, error: 'لم يختر ملف' };
  const formData = new FormData();
  formData.append('file', file);
  return uploadBackupForm('/api/v1/backup/system/upload-full-archive', formData);
}

export async function backupRestoreSystemFromUpload(
  file: File | null | undefined,
  confirmPhrase: string,
): Promise<ApiParsedResult<BackupUploadResult | BackupRestoreResult>> {
  if (!file) return { success: false, error: 'لم يختر ملف' };
  const formData = new FormData();
  formData.append('file', file);
  formData.append('confirmPhrase', confirmPhrase || '');
  return uploadBackupForm('/api/v1/backup/system/restore-upload', formData);
}
