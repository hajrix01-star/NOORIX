import type { BackupJob, BackupScheduleForm, TranslationFn } from '../../settingsTypes';

export type UnifiedBackupRow = BackupJob & {
  rowScope: 'system' | 'company';
};

export type BackupLabelFn = (ar: string, en: string) => string;

export function sortByCreatedDesc(left: BackupJob, right: BackupJob): number {
  return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
}

export function isCompletedBackup(job: BackupJob | null | undefined): job is BackupJob {
  return Boolean(job && job.status === 'completed' && job.localRelativePath);
}

export function isTrustedBackup(job: BackupJob | null | undefined): job is BackupJob {
  return isCompletedBackup(job) && job.verifyOk === true;
}

export function scheduleText(form: Pick<BackupScheduleForm, 'scheduleHour' | 'scheduleMinute'>): string {
  return `${String(form.scheduleHour).padStart(2, '0')}:${String(form.scheduleMinute).padStart(2, '0')}`;
}

export function verificationLabel(job: BackupJob, t: TranslationFn, label: BackupLabelFn): string {
  if (job.verifyOk === true) return t('backupVerifyOk');
  if (job.verifyOk === false) return label('فشل الفحص', 'Verify failed');
  if (job.status === 'completed') return label('لم يفحص', 'Not checked');
  return '-';
}

export function verificationColor(job: BackupJob): 'green' | 'red' | 'gray' {
  if (job.verifyOk === true) return 'green';
  if (job.verifyOk === false) return 'red';
  return 'gray';
}

export function backupRowScope(job: BackupJob): UnifiedBackupRow['rowScope'] {
  return job.scope === 'system_full' || job.scope === 'database_full' ? 'system' : 'company';
}

export function uniqueUnifiedRows(systemJobs: BackupJob[], companyJobs: BackupJob[]): UnifiedBackupRow[] {
  const seen = new Set<string>();
  const rows: UnifiedBackupRow[] = [];
  for (const job of [...systemJobs, ...companyJobs].sort(sortByCreatedDesc)) {
    if (seen.has(job.id)) continue;
    seen.add(job.id);
    rows.push({ ...job, rowScope: backupRowScope(job) });
  }
  return rows;
}

export function latestBackup(jobs: BackupJob[]): BackupJob | null {
  return [...jobs].sort(sortByCreatedDesc)[0] || null;
}

export function latestTrustedBackup(jobs: BackupJob[]): BackupJob | null {
  return [...jobs].filter(isTrustedBackup).sort(sortByCreatedDesc)[0] || null;
}

export function latestFailedBackup(jobs: BackupJob[]): BackupJob | null {
  return [...jobs].filter((job) => job.status === 'failed' || job.verifyOk === false).sort(sortByCreatedDesc)[0] || null;
}

