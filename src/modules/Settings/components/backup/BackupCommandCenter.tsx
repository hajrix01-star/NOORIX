import React, { type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { Badge, Button, Card, Checkbox, FileInput, Input, SimpleTable } from '../../../../ui';
import type {
  BackupConfigData,
  BackupImportModal,
  BackupJob,
  BackupRestoreModal,
  BackupRestorePcModal,
  BackupScheduleForm,
  BackupSchedulePatch,
  BackupSystemDownloadVariables,
  SettingsApiResult,
  SettingsCompany,
  SettingsMutationLike,
  SettingsVoidMutationLike,
  TranslationFn,
} from '../../settingsTypes';
import {
  formatBackupDate,
  formatFileSize,
  scopeLabel,
} from './backupTabHelpers';
import {
  latestBackup,
  latestFailedBackup,
  latestTrustedBackup,
  scheduleText,
  uniqueUnifiedRows,
} from './backupCommandCenterModel';
import { BackupStat, ScheduleNumberInput, buildBackupCommandCenterColumns } from './backupCommandCenterUi';

type BackupCommandCenterProps = {
  t: TranslationFn;
  lang: string;
  canSystemBackup: boolean;
  activeCompanies: SettingsCompany[];
  companyId: string;
  setCompanyId: (value: string) => void;
  coForm: BackupScheduleForm;
  setCoForm: Dispatch<SetStateAction<BackupScheduleForm>>;
  coCfgRes?: SettingsApiResult<BackupConfigData>;
  sysForm: BackupScheduleForm;
  setSysForm: Dispatch<SetStateAction<BackupScheduleForm>>;
  sysCfgRes?: SettingsApiResult<BackupConfigData>;
  jobs: BackupJob[];
  isLoading: boolean;
  sysJobs: BackupJob[];
  sysJobsLoading: boolean;
  triggerMut: SettingsVoidMutationLike;
  saveCoMut: SettingsMutationLike<BackupSchedulePatch & { companyId: string }>;
  saveSysMut: SettingsMutationLike<BackupSchedulePatch>;
  runFullArchiveMut: SettingsVoidMutationLike;
  reportMut: SettingsMutationLike<string>;
  downloadMut: SettingsMutationLike<string>;
  verifyCoMut: SettingsMutationLike<string>;
  downloadSysMut: SettingsMutationLike<BackupSystemDownloadVariables>;
  verifySysMut: SettingsMutationLike<string>;
  restoreMut: SettingsMutationLike<{ jobId: string; confirmPhrase: string }>;
  uploadSysArchiveMut: SettingsMutationLike<File>;
  restorePcMut: SettingsMutationLike<{ file: File; confirmPhrase: string }>;
  systemArchiveFileRef: RefObject<HTMLInputElement>;
  restoreFromPcFileRef: RefObject<HTMLInputElement>;
  setImportNameAr: (value: string) => void;
  setImportConfirmed: (value: boolean) => void;
  setImportModal: (value: BackupImportModal | null) => void;
  setRestorePhrase: (value: string) => void;
  setRestoreModal: (value: BackupRestoreModal | null) => void;
  setRestorePcPhrase: (value: string) => void;
  setRestorePcModal: (value: BackupRestorePcModal | null) => void;
};

export function BackupCommandCenter({
  t,
  lang,
  canSystemBackup,
  activeCompanies,
  companyId,
  setCompanyId,
  coForm,
  setCoForm,
  coCfgRes,
  sysForm,
  setSysForm,
  sysCfgRes,
  jobs,
  isLoading,
  sysJobs,
  sysJobsLoading,
  triggerMut,
  saveCoMut,
  saveSysMut,
  runFullArchiveMut,
  reportMut,
  downloadMut,
  verifyCoMut,
  downloadSysMut,
  verifySysMut,
  restoreMut,
  uploadSysArchiveMut,
  restorePcMut,
  systemArchiveFileRef,
  restoreFromPcFileRef,
  setImportNameAr,
  setImportConfirmed,
  setImportModal,
  setRestorePhrase,
  setRestoreModal,
  setRestorePcPhrase,
  setRestorePcModal,
}: BackupCommandCenterProps) {
  const label = React.useCallback((ar: string, en: string) => (lang === 'en' ? en : ar), [lang]);
  const latestSystem = React.useMemo(() => latestBackup(sysJobs), [sysJobs]);
  const latestTrustedSystem = React.useMemo(() => latestTrustedBackup(sysJobs), [sysJobs]);
  const latestFailed = React.useMemo(() => latestFailedBackup([...sysJobs, ...jobs]), [jobs, sysJobs]);
  const rows = React.useMemo(() => uniqueUnifiedRows(sysJobs, jobs).slice(0, 30), [jobs, sysJobs]);
  const isBusy = runFullArchiveMut.isPending || triggerMut.isPending || saveSysMut.isPending || saveCoMut.isPending;

  const columns = React.useMemo(() => buildBackupCommandCenterColumns({
    downloadMut,
    downloadSysMut,
    label,
    lang,
    reportMut,
    restoreMut,
    restorePcMut,
    setImportConfirmed,
    setImportModal,
    setImportNameAr,
    setRestoreModal,
    setRestorePhrase,
    t,
    verifyCoMut,
    verifySysMut,
  }), [
    downloadMut,
    downloadSysMut,
    label,
    lang,
    reportMut,
    restoreMut,
    restorePcMut,
    setImportConfirmed,
    setImportModal,
    setImportNameAr,
    setRestoreModal,
    setRestorePhrase,
    t,
    verifyCoMut,
    verifySysMut,
  ]);

  return (
    <div className="flex flex-col gap-4 md:gap-5 min-w-0">
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

      {canSystemBackup && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <Card padding="sm" className="flex flex-col gap-3 min-w-0 border-l-[3px] border-l-nx-profit">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="m-0 text-[14px] font-extrabold text-noorix-text">{t('backupSystemHeading')}</h3>
                <p className="m-0 mt-1 text-[12px] text-noorix-muted leading-relaxed">{t('backupSystemFullArchiveHint')}</p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="min-h-[40px] md:min-w-[190px]"
                disabled={runFullArchiveMut.isPending}
                onClick={() => runFullArchiveMut.mutate()}
              >
                {runFullArchiveMut.isPending ? t('loading') : label('إنشاء نسخة موثوقة', 'Create trusted backup')}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(160px,0.9fr)_repeat(3,minmax(92px,0.55fr))_auto] md:items-end">
              <Checkbox
                checked={sysForm.enabled}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSysForm((previous) => ({ ...previous, enabled: event.target.checked }))}
                label={t('backupSystemEnabled')}
                containerClassName="nx-checkbox flex items-center gap-2.5 text-[13px] font-medium text-noorix-text cursor-pointer select-none pb-2"
              />
              <ScheduleNumberInput
                id="backup-system-hour"
                label={t('backupSystemHour')}
                value={sysForm.scheduleHour}
                min={0}
                max={23}
                fallback={0}
                onValue={(scheduleHour) => setSysForm((previous) => ({ ...previous, scheduleHour }))}
              />
              <ScheduleNumberInput
                id="backup-system-minute"
                label={t('backupSystemMinute')}
                value={sysForm.scheduleMinute}
                min={0}
                max={59}
                fallback={0}
                onValue={(scheduleMinute) => setSysForm((previous) => ({ ...previous, scheduleMinute }))}
              />
              <ScheduleNumberInput
                id="backup-system-retention"
                label={t('backupSystemRetention')}
                value={sysForm.retentionCount}
                min={1}
                max={50}
                fallback={10}
                onValue={(retentionCount) => setSysForm((previous) => ({ ...previous, retentionCount }))}
              />
              <Button
                type="button"
                size="sm"
                className="min-h-[40px]"
                disabled={saveSysMut.isPending}
                onClick={() =>
                  saveSysMut.mutate({
                    enabled: sysForm.enabled,
                    scheduleHour: sysForm.scheduleHour,
                    scheduleMinute: sysForm.scheduleMinute,
                    retentionCount: sysForm.retentionCount,
                  })
                }
              >
                {saveSysMut.isPending ? t('loading') : t('backupSystemSave')}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-noorix-border bg-noorix-bg-muted/40 px-3 py-2">
              <span className="text-[11px] font-semibold text-noorix-muted">
                {label('آخر تشغيل مجدول', 'Last scheduled run')}:
              </span>
              <span dir="ltr" className="text-[12px] font-bold text-noorix-text">
                {sysCfgRes?.success && sysCfgRes.data?.lastRunDayRiyadh ? sysCfgRes.data.lastRunDayRiyadh : '-'}
              </span>
              <span className="text-[11px] text-noorix-muted">
                {label('التحميل اليدوي من زر تنزيل داخل السجل بعد نجاح الفحص.', 'Manual off-server copy is the download action after verification.')}
              </span>
            </div>
          </Card>

          <Card padding="sm" className="flex flex-col gap-3 min-w-0">
            <div>
              <h3 className="m-0 text-[14px] font-extrabold text-noorix-text">{label('نسخ شركة محددة', 'Single company backup')}</h3>
              <p className="m-0 mt-1 text-[12px] text-noorix-muted leading-relaxed">
                {label('لقطة منطقية للشركة للاستيراد كشركة جديدة عند الحاجة.', 'Logical company snapshot for importing as a new company when needed.')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <Input
                type="select"
                label={t('backupCompanyPick')}
                value={companyId}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => setCompanyId(event.target.value)}
                disabled={!activeCompanies.length}
              >
                {activeCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.nameAr || company.nameEn || company.id}
                  </option>
                ))}
              </Input>
              <Button
                type="button"
                size="sm"
                variant="primary"
                className="min-h-[40px]"
                disabled={!companyId || !activeCompanies.length || triggerMut.isPending}
                onClick={() => triggerMut.mutate()}
              >
                {triggerMut.isPending ? t('loading') : t('backupRunNow')}
              </Button>
            </div>
            <details className="rounded-md border border-noorix-border bg-noorix-bg-muted/30 px-3 py-2">
              <summary className="cursor-pointer text-[12px] font-bold text-noorix-muted list-none [&::-webkit-details-marker]:hidden">
                {t('backupCompanyScheduleTitle')}
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <Checkbox
                  checked={coForm.enabled}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setCoForm((previous) => ({ ...previous, enabled: event.target.checked }))}
                  disabled={!companyId}
                  label={t('backupCompanyDailyEnabled')}
                  containerClassName="nx-checkbox flex items-center gap-2.5 text-[13px] font-medium text-noorix-text cursor-pointer select-none"
                />
                <div className="grid grid-cols-3 gap-2">
                  <ScheduleNumberInput id="backup-company-hour" label={t('backupSystemHour')} value={coForm.scheduleHour} min={0} max={23} fallback={0} disabled={!companyId} onValue={(scheduleHour) => setCoForm((previous) => ({ ...previous, scheduleHour }))} />
                  <ScheduleNumberInput id="backup-company-minute" label={t('backupSystemMinute')} value={coForm.scheduleMinute} min={0} max={59} fallback={0} disabled={!companyId} onValue={(scheduleMinute) => setCoForm((previous) => ({ ...previous, scheduleMinute }))} />
                  <ScheduleNumberInput id="backup-company-retention" label={t('backupCompanyRetention')} value={coForm.retentionCount} min={1} max={50} fallback={5} disabled={!companyId} onValue={(retentionCount) => setCoForm((previous) => ({ ...previous, retentionCount }))} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-noorix-muted">
                    {t('backupCompanyLastRun')}: <strong dir="ltr">{coCfgRes?.success && coCfgRes.data?.lastRunDayRiyadh ? coCfgRes.data.lastRunDayRiyadh : '-'}</strong>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!companyId || saveCoMut.isPending}
                    onClick={() =>
                      saveCoMut.mutate({
                        companyId,
                        enabled: coForm.enabled,
                        scheduleHour: coForm.scheduleHour,
                        scheduleMinute: coForm.scheduleMinute,
                        retentionCount: coForm.retentionCount,
                      })
                    }
                  >
                    {saveCoMut.isPending ? t('loading') : t('backupCompanySave')}
                  </Button>
                </div>
              </div>
            </details>
          </Card>
        </div>
      )}

      {canSystemBackup && (
        <details className="rounded-md border border-noorix-border bg-white px-3 py-2">
          <summary className="cursor-pointer text-[12px] font-extrabold text-noorix-muted list-none [&::-webkit-details-marker]:hidden">
            {label('أدوات الأرشيف والاستعادة', 'Archive and restore tools')}
          </summary>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <FileInput
              ref={systemArchiveFileRef}
              accept=".tar.gz,.tgz,application/gzip"
              className="sr-only"
              aria-label={t('backupSystemImportFromPc')}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) uploadSysArchiveMut.mutate(file);
              }}
            />
            <FileInput
              ref={restoreFromPcFileRef}
              accept=".tar.gz,.tgz,application/gzip"
              className="sr-only"
              aria-label={t('backupSystemRestoreFromPc')}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) {
                  setRestorePcPhrase('');
                  setRestorePcModal({ file });
                }
              }}
            />
            <Button type="button" size="sm" disabled={uploadSysArchiveMut.isPending} onClick={() => systemArchiveFileRef.current?.click()}>
              {uploadSysArchiveMut.isPending ? t('loading') : t('backupSystemImportFromPc')}
            </Button>
            <Button type="button" size="sm" variant="danger" disabled={restorePcMut.isPending} onClick={() => restoreFromPcFileRef.current?.click()}>
              {t('backupSystemRestoreFromPc')}
            </Button>
          </div>
        </details>
      )}

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
        {rows.some((row) => row.verifyOk === false && row.verifyError) && (
          <div className="rounded-md border border-noorix-red/30 bg-noorix-red/5 px-3 py-2 text-[12px] text-noorix-red">
            {rows.find((row) => row.verifyOk === false && row.verifyError)?.verifyError}
          </div>
        )}
        {isBusy && <p className="m-0 text-[12px] text-noorix-muted">{label('هناك عملية نسخ أو حفظ قيد التنفيذ.', 'A backup or save operation is running.')}</p>}
      </Card>
    </div>
  );
}
