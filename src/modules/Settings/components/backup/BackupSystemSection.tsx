import React, { type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { Button, Checkbox, FileInput, Input, Card, Divider, Badge } from '../../../../ui';
import type {
  BackupConfigData,
  BackupJob,
  BackupRestoreModal,
  BackupRestorePcModal,
  BackupSchedulePatch,
  BackupScheduleForm,
  BackupSystemDownloadVariables,
  SettingsApiResult,
  SettingsMutationLike,
  SettingsVoidMutationLike,
  TranslationFn,
} from '../../settingsTypes';
import { formatBackupDate, scopeLabel, statusLabel, statusBadgeColor } from './backupTabHelpers';

type BackupSystemSectionProps = {
  t: TranslationFn;
  lang: string;
  sysForm: BackupScheduleForm;
  setSysForm: Dispatch<SetStateAction<BackupScheduleForm>>;
  sysCfgRes?: SettingsApiResult<BackupConfigData>;
  saveSysMut: SettingsMutationLike<BackupSchedulePatch>;
  runFullArchiveMut: SettingsVoidMutationLike;
  systemArchiveFileRef: RefObject<HTMLInputElement>;
  restoreFromPcFileRef: RefObject<HTMLInputElement>;
  uploadSysArchiveMut: SettingsMutationLike<File>;
  restorePcMut: SettingsMutationLike<{ file: File; confirmPhrase: string }>;
  setRestorePcPhrase: (value: string) => void;
  setRestorePcModal: (value: BackupRestorePcModal | null) => void;
  sysJobsLoading: boolean;
  sysJobsRes: SettingsApiResult<BackupJob[]>;
  downloadSysMut: SettingsMutationLike<BackupSystemDownloadVariables>;
  verifySysMut: SettingsMutationLike<string>;
  restoreMut: SettingsMutationLike<{ jobId: string; confirmPhrase: string }>;
  setRestorePhrase: (value: string) => void;
  setRestoreModal: (value: BackupRestoreModal | null) => void;
};

export function BackupSystemSection({
  t,
  lang: _lang,
  sysForm,
  setSysForm,
  sysCfgRes,
  saveSysMut,
  runFullArchiveMut,
  systemArchiveFileRef,
  restoreFromPcFileRef,
  uploadSysArchiveMut,
  restorePcMut,
  setRestorePcPhrase,
  setRestorePcModal,
  sysJobsLoading,
  sysJobsRes,
  downloadSysMut,
  verifySysMut,
  restoreMut,
  setRestorePhrase,
  setRestoreModal,
}: BackupSystemSectionProps) {
  const systemJobs = sysJobsRes.success ? sysJobsRes.data : [];

  return (
    <section className="min-w-0 flex flex-col gap-0" aria-labelledby="backup-system-title">
      <Card padding="sm" className="flex flex-col gap-4 min-w-0 border-l-[3px] border-l-nx-profit">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 id="backup-system-title" className="text-[14px] font-bold text-noorix-text m-0">
            {t('backupSystemHeading')}
          </h3>
          <p className="text-[11px] text-noorix-muted m-0 leading-snug">{t('backupSystemIntro')}</p>
        </div>
        <Checkbox
          checked={sysForm.enabled}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSysForm((previous) => ({ ...previous, enabled: event.target.checked }))}
          label={t('backupSystemEnabled')}
          containerClassName="nx-checkbox flex items-center gap-2.5 text-[13px] font-medium text-noorix-text cursor-pointer select-none py-0.5"
        />
        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3 min-w-0">
          <ScheduleNumberInput
            id="backup-h"
            label={t('backupSystemHour')}
            value={sysForm.scheduleHour}
            min={0}
            max={23}
            fallback={0}
            onValue={(scheduleHour) => setSysForm((previous) => ({ ...previous, scheduleHour }))}
          />
          <ScheduleNumberInput
            id="backup-m"
            label={t('backupSystemMinute')}
            value={sysForm.scheduleMinute}
            min={0}
            max={59}
            fallback={0}
            onValue={(scheduleMinute) => setSysForm((previous) => ({ ...previous, scheduleMinute }))}
          />
          <ScheduleNumberInput
            id="backup-ret"
            label={t('backupSystemRetention')}
            value={sysForm.retentionCount}
            min={1}
            max={50}
            fallback={10}
            onValue={(retentionCount) => setSysForm((previous) => ({ ...previous, retentionCount }))}
          />
        </div>
        {sysCfgRes?.success && sysCfgRes.data?.lastRunDayRiyadh != null && (
          <p className="text-[11px] text-noorix-muted m-0">
            {t('backupSystemLastRun')}: <strong dir="ltr">{sysCfgRes.data.lastRunDayRiyadh}</strong>
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:items-center">
          <Button
            type="button"
            size="sm"
            className="w-full min-h-[44px] sm:w-auto"
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
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={runFullArchiveMut.isPending}
            onClick={() => runFullArchiveMut.mutate()}
          >
            {runFullArchiveMut.isPending ? t('loading') : t('backupSystemRunFullArchive')}
          </Button>
        </div>
        <p className="text-[10px] text-noorix-muted m-0 leading-snug">{t('backupSystemFullArchiveHint')}</p>

        <Divider />

        <p className="text-[11px] text-noorix-muted m-0 leading-relaxed min-w-0">{t('backupSystemLocalHint')}</p>
        <div className="flex flex-col gap-2 min-[380px]:flex-row min-[380px]:flex-wrap min-[380px]:items-center">
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
          <Button
            type="button"
            size="sm"
            variant="default"
            className="w-full min-h-[44px] min-[380px]:w-auto"
            disabled={uploadSysArchiveMut.isPending}
            onClick={() => systemArchiveFileRef.current?.click()}
          >
            {uploadSysArchiveMut.isPending ? t('loading') : t('backupSystemImportFromPc')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="w-full min-h-[44px] min-[380px]:w-auto"
            disabled={restorePcMut.isPending}
            onClick={() => restoreFromPcFileRef.current?.click()}
          >
            {t('backupSystemRestoreFromPc')}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-[12px] font-bold text-noorix-muted m-0 uppercase tracking-wide">
            {t('backupSystemJobs')}
          </h4>
          {sysJobsLoading && <p className="text-[12px] text-noorix-muted m-0">{t('loading')}</p>}
          {!sysJobsLoading && (!sysJobsRes.success || !systemJobs.length) && (
            <p className="text-[12px] text-noorix-muted m-0">{t('backupSystemNoJobs')}</p>
          )}
          <div className="flex flex-col gap-2 max-h-[min(50vh,360px)] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y pr-0.5 -mr-0.5 min-w-0">
            {systemJobs.map((systemJob) => (
              <div
                key={systemJob.id}
                className="flex flex-col gap-3 rounded-lg border border-noorix-border bg-noorix-bg-muted/40 px-3 py-3 min-[520px]:flex-row min-[520px]:items-stretch min-[520px]:justify-between"
              >
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span dir="ltr" className="text-[13px] font-semibold text-noorix-text tabular-nums break-all">
                      {systemJob.ordinal != null ? `#${systemJob.ordinal} - ` : ''}
                      {formatBackupDate(systemJob.createdAt)}
                    </span>
                    <Badge color={statusBadgeColor(systemJob.status)} size="sm" className="shrink-0">
                      {statusLabel(systemJob.status, t)}
                    </Badge>
                    {systemJob.verifyOk === true && (
                      <span className="text-[11px] text-noorix-green font-medium shrink-0">{t('backupVerifyOk')}</span>
                    )}
                  </div>
                  {systemJob.verifyOk === false && systemJob.verifyError && (
                    <span className="text-[11px] text-noorix-red break-words min-w-0">{systemJob.verifyError}</span>
                  )}
                  <span className="text-[10px] text-noorix-muted">{scopeLabel(systemJob.scope, t)}</span>
                </div>
                {systemJob.status === 'completed' && systemJob.localRelativePath && (
                  <div className="flex flex-col gap-2 min-[520px]:shrink-0 min-[520px]:flex-row min-[520px]:flex-wrap min-[520px]:items-center min-[520px]:justify-end min-[520px]:gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="w-full min-h-[44px] justify-center min-[520px]:w-auto min-[520px]:min-h-0"
                      disabled={downloadSysMut.isPending}
                      onClick={() =>
                        downloadSysMut.mutate({
                          jobId: systemJob.id,
                          suggestedName: `noorix-system-archive-${systemJob.ordinal ?? 'na'}-${systemJob.id}.tar.gz`,
                        })
                      }
                    >
                      {t('backupSystemDownload')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="w-full min-h-[44px] justify-center min-[520px]:w-auto min-[520px]:min-h-0"
                      disabled={verifySysMut.isPending}
                      onClick={() => verifySysMut.mutate(systemJob.id)}
                    >
                      {t('backupVerify')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      className="w-full min-h-[44px] justify-center min-[520px]:w-auto min-[520px]:min-h-0"
                      disabled={restoreMut.isPending || restorePcMut.isPending}
                      onClick={() => {
                        setRestorePhrase('');
                        setRestoreModal({ jobId: systemJob.id });
                      }}
                    >
                      {t('backupSystemRestore')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
}

type ScheduleNumberInputProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  fallback: number;
  onValue: (value: number) => void;
};

function ScheduleNumberInput({ id, label, value, min, max, fallback, onValue }: ScheduleNumberInputProps) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="text-[11px] font-bold text-noorix-muted">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        className="noorix-bank-filter"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onValue(Math.min(max, Math.max(min, Number(event.target.value) || fallback)))
        }
      />
    </div>
  );
}
