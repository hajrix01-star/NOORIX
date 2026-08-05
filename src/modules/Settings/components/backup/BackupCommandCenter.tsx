import React, { type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { Button, Card, Checkbox, FileInput, Input } from '../../../../ui';
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
import { scopeLabel } from './backupTabHelpers';
import {
  latestBackup,
  latestFailedBackup,
  latestTrustedBackup,
  uniqueUnifiedRows,
} from './backupCommandCenterModel';
import {
  BackupHistoryCard,
  BackupSafetyCenterCard,
  ScheduleNumberInput,
  buildBackupCommandCenterColumns,
} from './backupCommandCenterUi';

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
      <BackupSafetyCenterCard
        label={label}
        latestSystem={latestSystem}
        latestTrustedSystem={latestTrustedSystem}
        latestFailed={latestFailed}
        sysForm={sysForm}
      />

      {canSystemBackup && (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <Card padding="sm" className="flex flex-col gap-3 min-w-0 border-l-[3px] border-l-nx-profit">
            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <h3 className="m-0 text-[14px] font-extrabold text-noorix-text">{t('backupSystemHeading')}</h3>
                <p className="m-0 mt-1 text-[12px] text-noorix-muted leading-relaxed">{t('backupSystemFullArchiveHint')}</p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="min-h-[40px] w-full lg:w-auto lg:min-w-[190px]"
                disabled={runFullArchiveMut.isPending}
                onClick={() => runFullArchiveMut.mutate()}
              >
                {runFullArchiveMut.isPending ? t('loading') : label('إنشاء نسخة موثوقة', 'Create trusted backup')}
              </Button>
            </div>

            <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-noorix-border bg-noorix-bg-muted/25 p-3">
              <Checkbox
                checked={sysForm.enabled}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSysForm((previous) => ({ ...previous, enabled: event.target.checked }))}
                label={t('backupSystemEnabled')}
                containerClassName="nx-checkbox flex items-center gap-2.5 text-[13px] font-medium text-noorix-text cursor-pointer select-none"
              />
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                <ScheduleNumberInput id="backup-system-hour" label={t('backupSystemHour')} value={sysForm.scheduleHour} min={0} max={23} fallback={0} onValue={(scheduleHour) => setSysForm((previous) => ({ ...previous, scheduleHour }))} />
                <ScheduleNumberInput id="backup-system-minute" label={t('backupSystemMinute')} value={sysForm.scheduleMinute} min={0} max={59} fallback={0} onValue={(scheduleMinute) => setSysForm((previous) => ({ ...previous, scheduleMinute }))} />
                <ScheduleNumberInput id="backup-system-retention" label={t('backupSystemRetention')} value={sysForm.retentionCount} min={1} max={50} fallback={10} onValue={(retentionCount) => setSysForm((previous) => ({ ...previous, retentionCount }))} />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="min-h-[40px] w-full sm:w-auto"
                  disabled={saveSysMut.isPending}
                  onClick={() => saveSysMut.mutate({ enabled: sysForm.enabled, scheduleHour: sysForm.scheduleHour, scheduleMinute: sysForm.scheduleMinute, retentionCount: sysForm.retentionCount })}
                >
                  {saveSysMut.isPending ? t('loading') : t('backupSystemSave')}
                </Button>
              </div>
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
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <Input
                type="select"
                label={t('backupCompanyPick')}
                containerClassName="min-w-0"
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
                className="min-h-[40px] w-full sm:w-auto"
                disabled={!companyId || !activeCompanies.length || triggerMut.isPending}
                onClick={() => triggerMut.mutate()}
              >
                {triggerMut.isPending ? t('loading') : t('backupRunNow')}
              </Button>
            </div>
            <details className="min-w-0 overflow-hidden rounded-lg border border-noorix-border bg-noorix-bg-muted/30 px-3 py-2">
              <summary className="cursor-pointer text-[12px] font-bold text-noorix-muted list-none [&::-webkit-details-marker]:hidden">
                {t('backupCompanyScheduleTitle')}
              </summary>
              <div className="mt-3 flex min-w-0 flex-col gap-3">
                <Checkbox
                  checked={coForm.enabled}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setCoForm((previous) => ({ ...previous, enabled: event.target.checked }))}
                  disabled={!companyId}
                  label={t('backupCompanyDailyEnabled')}
                  containerClassName="nx-checkbox flex items-center gap-2.5 text-[13px] font-medium text-noorix-text cursor-pointer select-none"
                />
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                  <ScheduleNumberInput id="backup-company-hour" label={t('backupSystemHour')} value={coForm.scheduleHour} min={0} max={23} fallback={0} disabled={!companyId} onValue={(scheduleHour) => setCoForm((previous) => ({ ...previous, scheduleHour }))} />
                  <ScheduleNumberInput id="backup-company-minute" label={t('backupSystemMinute')} value={coForm.scheduleMinute} min={0} max={59} fallback={0} disabled={!companyId} onValue={(scheduleMinute) => setCoForm((previous) => ({ ...previous, scheduleMinute }))} />
                  <ScheduleNumberInput id="backup-company-retention" label={t('backupCompanyRetention')} value={coForm.retentionCount} min={1} max={50} fallback={5} disabled={!companyId} onValue={(retentionCount) => setCoForm((previous) => ({ ...previous, retentionCount }))} />
                </div>
                <div className="flex flex-col gap-3 border-t border-noorix-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[11px] text-noorix-muted">
                    {t('backupCompanyLastRun')}: <strong dir="ltr">{coCfgRes?.success && coCfgRes.data?.lastRunDayRiyadh ? coCfgRes.data.lastRunDayRiyadh : '-'}</strong>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-[40px] w-full sm:w-auto"
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

      <BackupHistoryCard
        t={t}
        label={label}
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        sysJobsLoading={sysJobsLoading}
        isBusy={isBusy}
      />
    </div>
  );
}
