import { formatSaudiDate, formatSaudiDateTime } from '../../../../utils/saudiDate';
import type { BackupCounts, BackupJobLite, BackupJobScope, BackupJobStatus, TranslationFn } from '../../settingsTypes';

export function formatBackupDate(iso: string | Date | null | undefined) {
  if (!iso) return '-';
  try {
    return formatSaudiDateTime(iso);
  } catch {
    return String(iso);
  }
}

export function formatFileSize(bytes: number | string | null | undefined) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function defaultImportCompanyName(job: BackupJobLite, t: TranslationFn, _lang?: string) {
  const companyName = job.company?.nameAr || t('backupImportDefaultCo');
  const rawDate = job.completedAt || job.createdAt;
  let dateText = '-';
  if (rawDate) {
    try {
      dateText = formatSaudiDate(rawDate);
    } catch {
      dateText = String(rawDate);
    }
  }
  const ordinal = job.ordinal != null ? ` - #${job.ordinal}` : '';
  return `${companyName} - ${dateText}${ordinal}`;
}

export function statLabel(t: TranslationFn, key: string) {
  const translationKey = `backupStat_${key}`;
  const text = t(translationKey);
  return text === translationKey ? key : text;
}

export function sortedCountEntries(counts: BackupCounts | null | undefined) {
  if (!counts || typeof counts !== 'object') return [];
  return Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
}

export function scopeLabel(scope: BackupJobScope | null | undefined, t: TranslationFn) {
  if (scope === 'company_logical') return t('backupScopeCompany');
  if (scope === 'database_full') return t('backupScopeFullDb');
  if (scope === 'system_full') return t('backupScopeSystemFull');
  return scope || '-';
}

export function statusLabel(status: BackupJobStatus | null | undefined, t: TranslationFn) {
  const labels: Record<string, string> = {
    pending: t('backupStatusPending'),
    running: t('backupStatusRunning'),
    completed: t('backupStatusCompleted'),
    failed: t('backupStatusFailed'),
    skipped_duplicate: t('backupStatusSkippedDup'),
  };
  return labels[String(status)] || status || '-';
}

export function statusBadgeColor(status: BackupJobStatus | null | undefined) {
  const colors: Record<string, string> = {
    completed: 'green',
    running: 'blue',
    pending: 'sky',
    failed: 'red',
    skipped_duplicate: 'gray',
  };
  return colors[String(status)] || 'gray';
}
