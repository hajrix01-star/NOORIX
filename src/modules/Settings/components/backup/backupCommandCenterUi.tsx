import React, { type ChangeEvent } from 'react';
import { Badge, Card, Input, KebabMenu, SimpleTable } from '../../../../ui';
import type { SimpleTableColumn } from '../../../../ui';
import type {
  BackupImportModal,
  BackupJob,
  BackupRestoreModal,
  BackupRestorePcModal,
  BackupScheduleForm,
  BackupSystemDownloadVariables,
  SettingsMutationLike,
  TranslationFn,
} from '../../settingsTypes';
import { defaultImportCompanyName, formatBackupDate, formatFileSize, statusBadgeColor, statusLabel } from './backupTabHelpers';
import { scheduleText, verificationColor, verificationLabel, type BackupLabelFn, type UnifiedBackupRow } from './backupCommandCenterModel';

export function BackupStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: 'neutral' | 'good' | 'bad' | 'warn';
}) {
  const valueClass =
    tone === 'good' ? 'text-noorix-green' : tone === 'bad' ? 'text-noorix-red' : tone === 'warn' ? 'text-noorix-amber' : 'text-noorix-text';
  return (
    <div className="rounded-md border border-noorix-border bg-white px-3 py-2 min-w-0">
      <div className="text-[11px] font-semibold text-noorix-muted leading-tight truncate">{label}</div>
      <div className={`mt-1 text-[14px] font-extrabold leading-tight truncate ${valueClass}`}>{value}</div>
    </div>
  );
}

type ScheduleNumberInputProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  fallback: number;
  disabled?: boolean;
  onValue: (value: number) => void;
};

export function ScheduleNumberInput({ id, label, value, min, max, fallback, disabled, onValue }: ScheduleNumberInputProps) {
  return (
    <Input
      id={id}
      type="number"
      min={min}
      max={max}
      label={label}
      className="noorix-bank-filter"
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) =>
        onValue(Math.min(max, Math.max(min, Number(event.target.value) || fallback)))
      }
      disabled={disabled}
    />
  );
}

type BackupCommandCenterColumnOptions = {
  t: TranslationFn;
  label: BackupLabelFn;
  lang: string;
  reportMut: SettingsMutationLike<string>;
  downloadMut: SettingsMutationLike<string>;
  verifyCoMut: SettingsMutationLike<string>;
  downloadSysMut: SettingsMutationLike<BackupSystemDownloadVariables>;
  verifySysMut: SettingsMutationLike<string>;
  restoreMut: SettingsMutationLike<{ jobId: string; confirmPhrase: string }>;
  restorePcMut: SettingsMutationLike<{ file: File; confirmPhrase: string }>;
  setImportNameAr: (value: string) => void;
  setImportConfirmed: (value: boolean) => void;
  setImportModal: (value: BackupImportModal | null) => void;
  setRestorePhrase: (value: string) => void;
  setRestoreModal: (value: BackupRestoreModal | null) => void;
};

export function buildBackupCommandCenterColumns({
  t,
  label,
  lang,
  reportMut,
  downloadMut,
  verifyCoMut,
  downloadSysMut,
  verifySysMut,
  restoreMut,
  restorePcMut,
  setImportNameAr,
  setImportConfirmed,
  setImportModal,
  setRestorePhrase,
  setRestoreModal,
}: BackupCommandCenterColumnOptions): SimpleTableColumn<UnifiedBackupRow>[] {
  return [
    {
      key: 'ordinal',
      label: '#',
      width: 86,
      align: 'center',
      render: (_value, row) => (
        <span dir="ltr" className="font-extrabold tabular-nums text-noorix-text">
          {row.ordinal != null ? row.ordinal : '-'}
        </span>
      ),
    },
    {
      key: 'scope',
      label: label('النسخة', 'Backup'),
      minWidth: 230,
      render: (_value, row) => (
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-bold text-noorix-text truncate">
            {row.company ? row.company.nameAr || row.company.nameEn || '-' : label('النظام الكامل', 'Full system')}
          </span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: label('التاريخ', 'Date'),
      minWidth: 170,
      align: 'center',
      render: (_value, row) => (
        <span dir="ltr" className="tabular-nums text-[12px]">
          {formatBackupDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'status',
      label: label('الحالة', 'Status'),
      minWidth: 130,
      align: 'center',
      render: (_value, row) => (
        <Badge color={statusBadgeColor(row.status)} size="sm">
          {statusLabel(row.status, t)}
        </Badge>
      ),
    },
    {
      key: 'verifyOk',
      label: label('المطابقة', 'Parity'),
      minWidth: 130,
      align: 'center',
      render: (_value, row) => (
        <Badge color={verificationColor(row)} size="sm">
          {verificationLabel(row, t, label)}
        </Badge>
      ),
    },
    {
      key: 'sizeBytes',
      label: label('الحجم', 'Size'),
      width: 110,
      numeric: true,
      render: (_value, row) => <span dir="ltr">{formatFileSize(row.sizeBytes)}</span>,
    },
    {
      key: 'actions',
      label: label('الإجراءات', 'Actions'),
      width: 92,
      align: 'center',
      render: (_value, row) => {
        const isSystem = row.rowScope === 'system';
        const canDownload = Boolean(row.status === 'completed' && row.localRelativePath);
        return (
          <KebabMenu
            ariaLabel={t('backupActionsMenu')}
            menuWidth={220}
            items={[
              { key: 'report', label: t('backupRestoreReport'), onClick: () => reportMut.mutate(row.id) },
              canDownload && isSystem && {
                key: 'download-system',
                label: t('backupSystemDownload'),
                disabled: downloadSysMut.isPending,
                onClick: () =>
                  downloadSysMut.mutate({
                    jobId: row.id,
                    suggestedName: `noorix-system-archive-${row.ordinal ?? 'na'}-${row.id}.tar.gz`,
                  }),
              },
              canDownload && !isSystem && {
                key: 'download-company',
                label: t('backupDownload'),
                disabled: downloadMut.isPending,
                onClick: () => downloadMut.mutate(row.id),
              },
              canDownload && {
                key: 'verify',
                label: t('backupVerify'),
                disabled: isSystem ? verifySysMut.isPending : verifyCoMut.isPending,
                onClick: () => (isSystem ? verifySysMut.mutate(row.id) : verifyCoMut.mutate(row.id)),
              },
              !isSystem && canDownload && {
                key: 'import-company',
                label: t('backupImportNewCompany'),
                onClick: () => {
                  setImportNameAr(defaultImportCompanyName(row, t, lang));
                  setImportConfirmed(false);
                  setImportModal({ jobId: row.id });
                },
              },
              isSystem && canDownload && {
                key: 'restore-system',
                label: t('backupSystemRestore'),
                disabled: restoreMut.isPending || restorePcMut.isPending,
                style: { color: 'var(--nx-red, #dc2626)' },
                onClick: () => {
                  setRestorePhrase('');
                  setRestoreModal({ jobId: row.id });
                },
              },
            ]}
          />
        );
      },
    },
  ];
}

type BackupSafetyCenterCardProps = {
  label: BackupLabelFn;
  latestSystem: BackupJob | null;
  latestTrustedSystem: BackupJob | null;
  latestFailed: BackupJob | null;
  sysForm: Pick<BackupScheduleForm, 'enabled' | 'scheduleHour' | 'scheduleMinute'>;
};

export function BackupSafetyCenterCard({
  label,
  latestSystem,
  latestTrustedSystem,
  latestFailed,
  sysForm,
}: BackupSafetyCenterCardProps) {
  return (
    <Card padding="sm" className="flex flex-col gap-3 min-w-0">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="m-0 text-[15px] font-extrabold text-noorix-text">{label('مركز سلامة النسخ', 'Backup safety center')}</h3>
          <p className="m-0 mt-1 text-[12px] text-noorix-muted leading-relaxed">
            {label('نسخة النظام لا تعتمد إلا بعد فحص الأرشيف واسترجاع مؤقت ومطابقة البيانات.', 'System backups are approved only after archive, temp restore, and data parity checks.')}
          </p>
        </div>
        {latestTrustedSystem ? (
          <Badge color="green" size="sm">{label('آخر نسخة نظام موثوقة', 'Latest trusted system backup')}</Badge>
        ) : (
          <Badge color={latestSystem ? 'amber' : 'gray'} size="sm">
            {latestSystem ? label('لا توجد نسخة نظام موثوقة بعد', 'No trusted system backup yet') : label('لا توجد نسخ بعد', 'No backups yet')}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <BackupStat
          label={label('آخر نسخة موثوقة', 'Latest trusted')}
          value={latestTrustedSystem ? formatBackupDate(latestTrustedSystem.completedAt || latestTrustedSystem.createdAt) : '-'}
          tone={latestTrustedSystem ? 'good' : 'warn'}
        />
        <BackupStat
          label={label('حجم آخر نسخة', 'Latest size')}
          value={latestSystem ? formatFileSize(latestSystem.sizeBytes) || '-' : '-'}
        />
        <BackupStat
          label={label('الجدولة', 'Schedule')}
          value={sysForm.enabled ? scheduleText(sysForm) : label('متوقفة', 'Off')}
          tone={sysForm.enabled ? 'good' : 'warn'}
        />
        <BackupStat
          label={label('آخر فشل', 'Latest failure')}
          value={latestFailed ? formatBackupDate(latestFailed.completedAt || latestFailed.createdAt) : '-'}
          tone={latestFailed ? 'bad' : 'good'}
        />
      </div>
    </Card>
  );
}

type BackupHistoryCardProps = {
  t: TranslationFn;
  label: BackupLabelFn;
  rows: UnifiedBackupRow[];
  columns: SimpleTableColumn<UnifiedBackupRow>[];
  isLoading: boolean;
  sysJobsLoading: boolean;
  isBusy: boolean;
};

export function BackupHistoryCard({ t, label, rows, columns, isLoading, sysJobsLoading, isBusy }: BackupHistoryCardProps) {
  const failedRow = rows.find((row) => row.verifyOk === false && row.verifyError);
  return (
    <Card padding="sm" className="flex flex-col gap-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="m-0 text-[14px] font-extrabold text-noorix-text">{t('backupJobHistory')}</h3>
          <p className="m-0 mt-1 text-[12px] text-noorix-muted">{label('سجل موحد لنسخ النظام ونسخ الشركات.', 'Unified history for system and company backups.')}</p>
        </div>
        <Badge color="gray" size="sm">{rows.length}</Badge>
      </div>
      <SimpleTable
        columns={columns}
        data={rows}
        stickyHeader
        maxHeight="520px"
        tableMinWidth={900}
        emptyMessage={isLoading || sysJobsLoading ? t('loading') : t('backupNoJobs')}
        getRowClassName={(row) => (row.verifyOk === false || row.status === 'failed' ? 'bg-noorix-red/5' : undefined)}
      />
      {failedRow && (
        <div className="rounded-md border border-noorix-red/30 bg-noorix-red/5 px-3 py-2 text-[12px] text-noorix-red">
          {failedRow.verifyError}
        </div>
      )}
      {isBusy && <p className="m-0 text-[12px] text-noorix-muted">{label('هناك عملية نسخ أو حفظ قيد التنفيذ.', 'A backup or save operation is running.')}</p>}
    </Card>
  );
}
