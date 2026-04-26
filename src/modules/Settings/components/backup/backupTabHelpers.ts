/**
 * دوال مساعدة لشاشة النسخ الاحتياطي — بدون React
 */
import { formatSaudiDate, formatSaudiDateTime } from '../../../../utils/saudiDate';

export function formatBackupDate(iso: any) {
  if (!iso) return '—';
  try {
    return formatSaudiDateTime(iso);
  } catch {
    return String(iso);
  }
}

export function formatFileSize(bytes: any) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** اسم افتراضي للاستيراد: شركة — تاريخ النسخة — #رقم */
export function defaultImportCompanyName(j: any, t: any, _lang: any) {
  const co = j.company?.nameAr || t('backupImportDefaultCo');
  const raw = j.completedAt || j.createdAt;
  let dateStr = '—';
  if (raw) {
    try {
      dateStr = formatSaudiDate(raw);
    } catch {
      dateStr = String(raw);
    }
  }
  const ord = j.ordinal != null ? ` — #${j.ordinal}` : '';
  return `${co} — ${dateStr}${ord}`;
}

export function statLabel(t: any, key: any) {
  const k = `backupStat_${key}`;
  const txt = t(k);
  return txt === k ? key : txt;
}

export function sortedCountEntries(counts: any) {
  if (!counts || typeof counts !== 'object') return [];
  return Object.entries(counts).sort(([a]: any, [b]: any) => a.localeCompare(b));
}

export function scopeLabel(scope: any, t: any) {
  if (scope === 'company_logical') return t('backupScopeCompany');
  if (scope === 'database_full') return t('backupScopeFullDb');
  if (scope === 'system_full') return t('backupScopeSystemFull');
  return scope;
}

export function statusLabel(s: any, t: any) {
  const m = {
    pending: t('backupStatusPending'),
    running: t('backupStatusRunning'),
    completed: t('backupStatusCompleted'),
    failed: t('backupStatusFailed'),
    skipped_duplicate: t('backupStatusSkippedDup'),
  };
  return (m as Record<string, string>)[String(s)] || s;
}

export function statusBadgeColor(status: any) {
  const m = {
    completed: 'green',
    running: 'blue',
    pending: 'sky',
    failed: 'red',
    skipped_duplicate: 'gray',
  };
  return (m as Record<string, string>)[String(status)] || 'gray';
}
