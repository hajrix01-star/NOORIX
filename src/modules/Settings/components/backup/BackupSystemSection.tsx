import React from 'react';
import { Button, Input, Card, Divider, Badge } from '../../../../ui';
import { formatBackupDate, scopeLabel, statusLabel, statusBadgeColor } from './backupTabHelpers';

/**
 * بطاقة نسخ النظام الكامل — للمالك / المدير العام فقط
 */
export function BackupSystemSection({
  t,
  lang,
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
}: any) {
  return (
    <section className="min-w-0 flex flex-col gap-0" aria-labelledby="backup-system-title">
      <Card padding="sm" className="flex flex-col gap-4 min-w-0 border-l-[3px] border-l-nx-profit">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 id="backup-system-title" className="text-[14px] font-bold text-noorix-text m-0">
            {t('backupSystemHeading')}
          </h3>
          <p className="text-[11px] text-noorix-muted m-0 leading-snug">{t('backupSystemIntro')}</p>
        </div>
        <label className="nx-checkbox flex items-center gap-2.5 text-[13px] font-medium text-noorix-text cursor-pointer select-none py-0.5">
          <input
            type="checkbox"
            checked={sysForm.enabled}
            onChange={(e: any) => setSysForm((p: any) => ({ ...p, enabled: e.target.checked }))}
          />
          <span>{t('backupSystemEnabled')}</span>
        </label>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3 min-w-0">
          <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor="backup-h" className="text-[11px] font-bold text-noorix-muted">
              {t('backupSystemHour')}
            </label>
            <Input
              id="backup-h"
              type="number"
              min={0}
              max={23}
              className="noorix-bank-filter"
              value={sysForm.scheduleHour}
              onChange={(e: any) =>
                setSysForm((p: any) => ({
                  ...p,
                  scheduleHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)),
                }))
              }
            />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor="backup-m" className="text-[11px] font-bold text-noorix-muted">
              {t('backupSystemMinute')}
            </label>
            <Input
              id="backup-m"
              type="number"
              min={0}
              max={59}
              className="noorix-bank-filter"
              value={sysForm.scheduleMinute}
              onChange={(e: any) =>
                setSysForm((p: any) => ({
                  ...p,
                  scheduleMinute: Math.min(59, Math.max(0, Number(e.target.value) || 0)),
                }))
              }
            />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor="backup-ret" className="text-[11px] font-bold text-noorix-muted">
              {t('backupSystemRetention')}
            </label>
            <Input
              id="backup-ret"
              type="number"
              min={1}
              max={50}
              className="noorix-bank-filter"
              value={sysForm.retentionCount}
              onChange={(e: any) =>
                setSysForm((p: any) => ({
                  ...p,
                  retentionCount: Math.min(50, Math.max(1, Number(e.target.value) || 10)),
                }))
              }
            />
          </div>
        </div>
        {sysCfgRes?.success && sysCfgRes.data?.lastRunDayRiyadh != null && (
          <p className="text-[11px] text-noorix-muted m-0">
            {t('backupSystemLastRun')}: <strong dir="ltr">{sysCfgRes.data.lastRunDayRiyadh}</strong>
          </p>
        )}

        <Divider />

        <div className="flex flex-col gap-2 min-w-0">
          <p className="text-[12px] font-semibold text-noorix-text m-0">{t('backupGdriveSectionTitle')}</p>
          <Input
            type="text"
            label={t('backupGdriveScriptUrlLabel')}
            value={sysForm.gdriveScriptUrl}
            onChange={(e: any) => setSysForm((p: any) => ({ ...p, gdriveScriptUrl: e.target.value }))}
            placeholder="https://script.google.com/macros/s/…/exec"
            className="nx-ltr text-left"
            dir="ltr"
          />
          <p className="text-[10px] text-noorix-muted m-0 leading-snug">{t('backupGdriveScriptUrlHint')}</p>
          <Input
            type="text"
            label={t('backupGdriveFolderLabel')}
            value={sysForm.gdriveFolderId}
            onChange={(e: any) => setSysForm((p: any) => ({ ...p, gdriveFolderId: e.target.value }))}
            placeholder="folderId أو رابط المجلد"
            className="nx-ltr text-left"
            dir="ltr"
          />
          <p className="text-[10px] text-noorix-muted m-0 leading-snug">{t('backupGdriveFolderHint')}</p>
        </div>

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
                gdriveScriptUrl: sysForm.gdriveScriptUrl,
                gdriveFolderId: sysForm.gdriveFolderId,
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
          <input
            ref={systemArchiveFileRef}
            type="file"
            accept=".tar.gz,.tgz,application/gzip"
            className="sr-only"
            aria-label={t('backupSystemImportFromPc')}
            onChange={(e: any) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) uploadSysArchiveMut.mutate(f);
            }}
          />
          <input
            ref={restoreFromPcFileRef}
            type="file"
            accept=".tar.gz,.tgz,application/gzip"
            className="sr-only"
            aria-label={t('backupSystemRestoreFromPc')}
            onChange={(e: any) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) {
                setRestorePcPhrase('');
                setRestorePcModal({ file: f });
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
          {!sysJobsLoading &&
            (!sysJobsRes?.success || !(Array.isArray(sysJobsRes.data) ? sysJobsRes.data : []).length) && (
              <p className="text-[12px] text-noorix-muted m-0">{t('backupSystemNoJobs')}</p>
            )}
          <div className="flex flex-col gap-2 max-h-[min(50vh,360px)] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y pr-0.5 -mr-0.5 min-w-0">
            {(Array.isArray(sysJobsRes?.data) ? sysJobsRes.data : []).map((sj: any) => (
              <div
                key={sj.id}
                className="flex flex-col gap-3 rounded-lg border border-noorix-border bg-noorix-bg-muted/40 px-3 py-3 min-[520px]:flex-row min-[520px]:items-stretch min-[520px]:justify-between"
              >
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span dir="ltr" className="text-[13px] font-semibold text-noorix-text tabular-nums break-all">
                      {sj.ordinal != null ? `#${sj.ordinal} · ` : ''}
                      {formatBackupDate(sj.createdAt)}
                    </span>
                    <Badge color={statusBadgeColor(sj.status)} size="sm" className="shrink-0">
                      {statusLabel(sj.status, t)}
                    </Badge>
                    {sj.verifyOk === true && (
                      <span className="text-[11px] text-noorix-green font-medium shrink-0">{t('backupVerifyOk')}</span>
                    )}
                  </div>
                  {sj.verifyOk === false && sj.verifyError && (
                    <span className="text-[11px] text-noorix-red break-words min-w-0">{sj.verifyError}</span>
                  )}
                  <span className="text-[10px] text-noorix-muted">{scopeLabel(sj.scope, t)}</span>
                </div>
                {sj.status === 'completed' && sj.localRelativePath && (
                  <div className="flex flex-col gap-2 min-[520px]:shrink-0 min-[520px]:flex-row min-[520px]:flex-wrap min-[520px]:items-center min-[520px]:justify-end min-[520px]:gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="w-full min-h-[44px] justify-center min-[520px]:w-auto min-[520px]:min-h-0"
                      disabled={downloadSysMut.isPending}
                      onClick={() =>
                        downloadSysMut.mutate({
                          jobId: sj.id,
                          suggestedName: `noorix-system-archive-${sj.ordinal ?? 'na'}-${sj.id}.tar.gz`,
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
                      onClick={() => verifySysMut.mutate(sj.id)}
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
                        setRestoreModal({ jobId: sj.id });
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
