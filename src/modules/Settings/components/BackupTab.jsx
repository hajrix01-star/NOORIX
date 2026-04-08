/**
 * النسخ الاحتياطي — لقطة منطقية لكل شركة، سجل، تقرير استرجاع، إعادة رفع خارجي
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  backupTriggerCompany,
  backupListJobs,
  backupRestoreReport,
  backupRetryExternal,
  backupDownloadJobFile,
  backupImportFromJob,
  refreshAuthSession,
  backupGetSystemConfig,
  backupPatchSystemConfig,
  backupListSystemJobs,
  backupRunSystemNow,
  backupVerifySystemJob,
  backupVerifyCompanyJob,
} from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useApp } from '../../../context/AppContext';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import { formatSaudiDate, formatSaudiDateTime } from '../../../utils/saudiDate';

function formatBackupDate(iso) {
  if (!iso) return '—';
  try {
    return formatSaudiDateTime(iso);
  } catch {
    return String(iso);
  }
}

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** اسم افتراضي للاستيراد: شركة — تاريخ النسخة — #رقم */
function defaultImportCompanyName(j, t, lang) {
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

function statLabel(t, key) {
  const k = `backupStat_${key}`;
  const txt = t(k);
  return txt === k ? key : txt;
}

function sortedCountEntries(counts) {
  if (!counts || typeof counts !== 'object') return [];
  return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
}

function BackupCountsGrid({ counts, t, lang }) {
  const rows = sortedCountEntries(counts);
  if (!rows.length) {
    return (
      <p className="m-0 text-[13px] text-noorix-muted">—</p>
    );
  }
  const total = rows.reduce((s, [, n]) => s + (Number(n) || 0), 0);
  return (
    <div className="grid gap-0">
      <div className="mb-2">
        <div className="text-[12px] font-extrabold text-noorix-muted">
          {t('backupReportCounts')}
        </div>
        <div className="text-[12px] text-noorix-muted mt-1">
          {t('backupReportTotalRows')}:{' '}
          <strong dir="ltr">{total.toLocaleString('en-GB')}</strong>
        </div>
      </div>
      {rows.map(([key, val]) => (
        <div
          key={key}
          className="grid gap-2 text-[13px] py-1.5 border-b border-noorix-border items-baseline [grid-template-columns:1fr_auto]"
        >
          <span className="text-noorix-text">{statLabel(t, key)}</span>
          <span dir="ltr" className="font-semibold tabular-nums">
            {Number(val).toLocaleString('en-GB')}
          </span>
        </div>
      ))}
    </div>
  );
}

function scopeLabel(scope, t) {
  if (scope === 'company_logical') return t('backupScopeCompany');
  if (scope === 'database_full') return t('backupScopeFullDb');
  return scope;
}

function statusLabel(s, t) {
  const m = {
    pending: t('backupStatusPending'),
    running: t('backupStatusRunning'),
    completed: t('backupStatusCompleted'),
    failed: t('backupStatusFailed'),
    skipped_duplicate: t('backupStatusSkippedDup'),
  };
  return m[s] || s;
}

export default function BackupTab({ activeCompanies = [] }) {
  const { t, lang } = useTranslation();
  const { user, setToken, setUser } = useAuth();
  const canSystemBackup = ['owner', 'super_admin'].includes(String(user?.role || '').toLowerCase());
  const setActiveCompany = useApp()?.setActiveCompany;
  const isAr = lang !== 'en';
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState(() => activeCompanies[0]?.id || '');
  const { showToast } = useToast();
  const [reportModal, setReportModal] = useState(null);
  const [importModal, setImportModal] = useState(null);
  const [importReportModal, setImportReportModal] = useState(null);
  const [importNameAr, setImportNameAr] = useState('');
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [sysForm, setSysForm] = useState({
    enabled: false,
    scheduleHour: 6,
    scheduleMinute: 0,
    retentionCount: 10,
  });

  const { data: jobsRes, isLoading } = useQuery({
    queryKey: ['backup-jobs'],
    queryFn: async () => backupListJobs(50),
    refetchInterval: 15_000,
  });

  const { data: sysCfgRes } = useQuery({
    queryKey: ['backup-system-config'],
    queryFn: () => backupGetSystemConfig(),
    enabled: canSystemBackup,
  });

  const { data: sysJobsRes, isLoading: sysJobsLoading } = useQuery({
    queryKey: ['backup-system-jobs'],
    queryFn: () => backupListSystemJobs(15),
    enabled: canSystemBackup,
    refetchInterval: 20_000,
  });

  React.useEffect(() => {
    if (!sysCfgRes?.success || !sysCfgRes.data) return;
    const d = sysCfgRes.data;
    if (typeof d !== 'object' || d.enabled === undefined) return;
    const h = Number(d.scheduleHour);
    const m = Number(d.scheduleMinute);
    const r = Number(d.retentionCount);
    setSysForm({
      enabled: !!d.enabled,
      scheduleHour: Number.isFinite(h) ? h : 6,
      scheduleMinute: Number.isFinite(m) ? m : 0,
      retentionCount: Math.min(50, Math.max(1, Number.isFinite(r) ? r : 10)),
    });
  }, [sysCfgRes]);

  const jobs = jobsRes?.success ? (Array.isArray(jobsRes.data) ? jobsRes.data : []) : [];

  const triggerMut = useApiMutation({
    mutationFn: () => backupTriggerCompany(companyId),
    invalidateQueries: [['backup-jobs']],
    successToast: () => t('backupStarted'),
    errorToast: (e) => e?.message || t('backupError'),
  });

  const reportMut = useApiMutation({
    mutationFn: (jobId) => backupRestoreReport(jobId),
    successToast: false,
    showErrorToast: true,
    errorToast: (e) => e?.message || t('backupError'),
    onSuccess: (res, jobId) => {
      setReportModal({ jobId, payload: res.data });
    },
  });

  const downloadMut = useApiMutation({
    mutationFn: (jobId) => backupDownloadJobFile(jobId),
    successToast: () => t('backupDownloadOk'),
    errorToast: (e) => e?.message || t('backupError'),
  });

  const importMut = useApiMutation({
    mutationFn: ({ jobId, nameAr }) => backupImportFromJob({ jobId, nameAr }),
    successToast: false,
    showErrorToast: true,
    errorToast: (e) => e?.message || t('backupError'),
    onSuccess: async (res) => {
      setImportModal(null);
      setImportNameAr('');
      const ref = await refreshAuthSession();
      if (ref.success && ref.data?.access_token) {
        setToken(ref.data.access_token);
        if (ref.data.user) setUser(ref.data.user);
      }
      await qc.invalidateQueries({ queryKey: ['backup-jobs'] });
      await Promise.all([
        qc.refetchQueries({ queryKey: ['companies'] }),
        qc.refetchQueries({ queryKey: ['companies', false] }),
      ]);
      const nid = res.data?.newCompanyId;
      if (nid && typeof setActiveCompany === 'function') setActiveCompany(nid);
      setImportReportModal(res.data || null);
      showToast(
        ref.success ? t('backupImportOk') : `${t('backupImportOk')} — ${t('backupImportSessionHint')}`,
        ref.success ? 'success' : 'error',
      );
    },
  });

  const retryMut = useApiMutation({
    mutationFn: (jobId) => backupRetryExternal(jobId),
    invalidateQueries: [['backup-jobs']],
    successToast: () => t('backupRetryOk'),
    errorToast: (e) => e?.message || t('backupError'),
  });

  const saveSysMut = useApiMutation({
    mutationFn: (body) => backupPatchSystemConfig(body),
    invalidateQueries: [['backup-system-config']],
    successToast: () => t('backupSettingsSaved'),
    errorToast: (e) => e?.message || t('backupError'),
  });

  const runSysMut = useApiMutation({
    mutationFn: () => backupRunSystemNow(),
    invalidateQueries: [['backup-system-jobs'], ['backup-jobs']],
    successToast: () => t('backupStarted'),
    errorToast: (e) => e?.message || t('backupError'),
  });

  const verifySysMut = useApiMutation({
    mutationFn: (jobId) => backupVerifySystemJob(jobId),
    invalidateQueries: [['backup-system-jobs']],
    successToast: () => t('backupVerifyOk'),
    errorToast: (e) => e?.message || t('backupVerifyBad'),
  });

  const verifyCoMut = useApiMutation({
    mutationFn: (jobId) => backupVerifyCompanyJob(jobId),
    invalidateQueries: [['backup-jobs']],
    successToast: () => t('backupVerifyOk'),
    errorToast: (e) => e?.message || t('backupVerifyBad'),
  });

  React.useEffect(() => {
    if (!companyId && activeCompanies[0]?.id) setCompanyId(activeCompanies[0].id);
  }, [activeCompanies, companyId]);

  return (
    <div className="backup-tab">
      <div className="backup-tab__intro">
        <h2>{t('backupHeading')}</h2>
        <p>{t('backupIntro')}</p>
      </div>

      <div className={`backup-tab__config-grid${canSystemBackup ? ' backup-tab__config-grid--dual' : ''}`}>
        <section className="backup-panel" aria-labelledby="backup-company-title">
          <h3 id="backup-company-title" className="backup-panel__title">
            {t('backupCompanySection')}
          </h3>
          <div className="backup-run-row">
            <Input
              type="select"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={!activeCompanies.length}
              aria-label={t('backupCompanySection')}
            >
              {activeCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr || c.nameEn || c.id}
                </option>
              ))}
            </Input>
            <Button
              type="button"
              variant="primary"
              disabled={!companyId || !activeCompanies.length || triggerMut.isPending}
              onClick={() => triggerMut.mutate()}
            >
              {triggerMut.isPending ? t('loading') : t('backupRunNow')}
            </Button>
          </div>
          {!activeCompanies.length && (
            <p className="backup-meta-line m-0">
              {t('noActiveCompanies')}
            </p>
          )}
          <ul className="backup-hint-list">
            <li>{t('backupBulletDedup')}</li>
            <li>{t('backupBulletExternal')}</li>
            <li>{t('backupBulletResume')}</li>
            <li>{t('backupBulletReport')}</li>
            <li>{t('backupBulletDaily')}</li>
          </ul>
        </section>

        {canSystemBackup && (
          <section className="backup-panel backup-panel--system" aria-labelledby="backup-system-title">
            <h3 id="backup-system-title" className="backup-panel__title">
              {t('backupSystemHeading')}
            </h3>
            <p className="backup-meta-line m-0">
              {t('backupSystemIntro')}
            </p>
            <label className="nx-checkbox backup-check-row">
              <input
                type="checkbox"
                checked={sysForm.enabled}
                onChange={(e) => setSysForm((p) => ({ ...p, enabled: e.target.checked }))}
              />
              <span>{t('backupSystemEnabled')}</span>
            </label>
            <div className="backup-form-grid">
              <div className="backup-field">
                <label htmlFor="backup-h">{t('backupSystemHour')}</label>
                <Input
                  id="backup-h"
                  type="number"
                  min={0}
                  max={23}
                  className="noorix-bank-filter"
                  value={sysForm.scheduleHour}
                  onChange={(e) =>
                    setSysForm((p) => ({ ...p, scheduleHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)) }))
                  }
                />
              </div>
              <div className="backup-field">
                <label htmlFor="backup-m">{t('backupSystemMinute')}</label>
                <Input
                  id="backup-m"
                  type="number"
                  min={0}
                  max={59}
                  className="noorix-bank-filter"
                  value={sysForm.scheduleMinute}
                  onChange={(e) =>
                    setSysForm((p) => ({ ...p, scheduleMinute: Math.min(59, Math.max(0, Number(e.target.value) || 0)) }))
                  }
                />
              </div>
              <div className="backup-field">
                <label htmlFor="backup-ret">{t('backupSystemRetention')}</label>
                <Input
                  id="backup-ret"
                  type="number"
                  min={1}
                  max={50}
                  className="noorix-bank-filter"
                  value={sysForm.retentionCount}
                  onChange={(e) =>
                    setSysForm((p) => ({
                      ...p,
                      retentionCount: Math.min(50, Math.max(1, Number(e.target.value) || 10)),
                    }))
                  }
                />
              </div>
            </div>
            {sysCfgRes?.success && sysCfgRes.data?.lastRunDayRiyadh != null && (
              <div className="backup-meta-line">
                {t('backupSystemLastRun')}: <strong dir="ltr">{sysCfgRes.data.lastRunDayRiyadh}</strong>
              </div>
            )}
            <div className="backup-actions-row">
              <Button
                type="button"
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
                variant="primary"
                disabled={runSysMut.isPending}
                onClick={() => runSysMut.mutate()}
              >
                {runSysMut.isPending ? t('loading') : t('backupSystemRunNow')}
              </Button>
            </div>

            <h4 className="backup-subtitle">{t('backupSystemJobs')}</h4>
            {sysJobsLoading && <div className="backup-meta-line">{t('loading')}</div>}
            {!sysJobsLoading && (!sysJobsRes?.success || !(Array.isArray(sysJobsRes.data) ? sysJobsRes.data : []).length) && (
              <div className="backup-meta-line">{t('backupSystemNoJobs')}</div>
            )}
            <div className="backup-sys-jobs">
              {(Array.isArray(sysJobsRes?.data) ? sysJobsRes.data : []).map((sj) => (
                <div key={sj.id} className="backup-sys-job">
                  <div className="flex items-center flex-wrap gap-2.5 min-w-0">
                    <span dir="ltr" className="font-bold">
                      {sj.ordinal != null ? `#${sj.ordinal} · ` : ''}
                      {formatBackupDate(sj.createdAt, lang)}
                    </span>
                    <span className="backup-job__status m-0" data-status={sj.status || ''}>
                      {statusLabel(sj.status, t)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 items-stretch">
                    {sj.verifyOk === true && (
                      <span className="text-[11px] text-noorix-green">{t('backupVerifyOk')}</span>
                    )}
                    {sj.verifyOk === false && sj.verifyError && (
                      <span className="text-[11px] break-words text-noorix-red">{sj.verifyError}</span>
                    )}
                    {sj.status === 'completed' && sj.localRelativePath && (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={verifySysMut.isPending}
                        onClick={() => verifySysMut.mutate(sj.id)}
                      >
                        {t('backupVerify')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <section className="backup-tab__log" aria-labelledby="backup-log-title">
        <h3 id="backup-log-title" className="backup-log-title">
          {t('backupJobHistory')}
        </h3>
        {isLoading && <div className="backup-meta-line">{t('loading')}</div>}
        {!isLoading && jobs.length === 0 && <div className="backup-meta-line">{t('backupNoJobs')}</div>}
        <div className="backup-job-list">
          {jobs.map((j) => {
            const metaParts = [
              formatSaudiDateTime(j.createdAt),
              j.sizeBytes != null ? formatFileSize(j.sizeBytes) : '',
              j.durationMs != null ? `${j.durationMs} ms` : '',
              j.externalUploaded ? t('backupExternalOk') : j.externalError ? t('backupExternalPending') : '',
            ].filter(Boolean);
            return (
              <article key={j.id} className="backup-job">
                <div className="backup-job__head">
                  <div className="backup-job__text">
                    <h4 className="backup-job__title">
                      {scopeLabel(j.scope, t)}
                      {j.company ? ` — ${j.company.nameAr || j.company.nameEn || ''}` : ''}
                      {j.ordinal != null ? ` · ${t('backupOrdinalLabel')} ${j.ordinal}` : ''}
                    </h4>
                    <div className="backup-job__meta">{metaParts.join(' · ')}</div>
                  </div>
                  <span className="backup-job__status" data-status={j.status || ''}>
                    {statusLabel(j.status, t)}
                  </span>
                </div>
                {j.errorMessage && (
                  <div className="backup-job__flags text-noorix-red">
                    {j.errorMessage}
                  </div>
                )}
                {j.verifyOk === true && (
                  <div className="backup-job__flags text-noorix-green">
                    {t('backupVerifyOk')}
                  </div>
                )}
                {j.verifyOk === false && j.verifyError && (
                  <div className="backup-job__flags text-noorix-red">
                    {j.verifyError}
                  </div>
                )}
                <div className="backup-job-actions">
                  <Button
                    type="button"
                    disabled={reportMut.isPending}
                    onClick={() => reportMut.mutate(j.id)}
                  >
                    {t('backupRestoreReport')}
                  </Button>
                  {j.scope === 'company_logical' && j.status === 'completed' && j.localRelativePath && (
                    <>
                      <Button
                        type="button"
                        disabled={downloadMut.isPending}
                        onClick={() => downloadMut.mutate(j.id)}
                      >
                        {t('backupDownload')}
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        disabled={importMut.isPending}
                        onClick={() => {
                          setImportNameAr(defaultImportCompanyName(j, t, lang));
                          setImportConfirmed(false);
                          setImportModal({ jobId: j.id });
                        }}
                      >
                        {t('backupImportNewCompany')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={verifyCoMut.isPending}
                        onClick={() => verifyCoMut.mutate(j.id)}
                      >
                        {t('backupVerify')}
                      </Button>
                    </>
                  )}
                  {!j.externalUploaded && j.status === 'completed' && j.localRelativePath && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={retryMut.isPending}
                      onClick={() => retryMut.mutate(j.id)}
                    >
                      {t('backupRetryExternal')}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <AdaptiveSheet
        open={!!importModal}
        onClose={() => !importMut.isPending && (setImportModal(null), setImportConfirmed(false))}
        title={t('backupImportNewCompany')}
        size="md"
        side="start"
        className="backup-import-drawer"
      >
        <div
          className="text-[13px] font-medium py-[10px] px-[14px] mb-[14px] rounded-md leading-[1.65] bg-noorix-red/10 border border-noorix-red/45 text-noorix-red"
          role="alert"
        >
          {isAr
            ? '⚠️ تحذير: سيتم إنشاء شركة جديدة كاملة من هذه النسخة الاحتياطية. تأكد من صحة النسخة قبل المتابعة.'
            : '⚠️ Warning: A new company will be created from this backup. Make sure the backup is correct before proceeding.'}
        </div>

        <p className="text-[13px] text-noorix-muted m-0 mb-3 leading-[1.6]">
          {t('backupImportWarn')}
        </p>

        <Input
          type="text"
          label={t('backupImportNameLabel')}
          value={importNameAr}
          onChange={(e) => setImportNameAr(e.target.value)}
        />

        <label className="nx-checkbox text-[13px] text-noorix-text mt-3 mb-4 leading-[1.5]">
          <input
            type="checkbox"
            checked={importConfirmed}
            onChange={(e) => setImportConfirmed(e.target.checked)}
          />
          <span>
            {isAr
              ? 'أؤكد أنني أرغب في إنشاء شركة جديدة من هذه النسخة الاحتياطية'
              : 'I confirm I want to create a new company from this backup'}
          </span>
        </label>

        <div className="flex items-center justify-end flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={importMut.isPending}
            onClick={() => { setImportModal(null); setImportConfirmed(false); }}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={importMut.isPending || !importNameAr.trim() || !importConfirmed}
            onClick={() => importMut.mutate({ jobId: importModal.jobId, nameAr: importNameAr.trim() })}
          >
            {importMut.isPending ? t('loading') : t('backupImportRun')}
          </Button>
        </div>
      </AdaptiveSheet>

      <AdaptiveSheet
        open={!!reportModal}
        onClose={() => setReportModal(null)}
        title={t('backupRestoreReport')}
        size="md"
        side="start"
        className="backup-restore-report-drawer"
      >
        {reportModal && (
          <>
        <p className="text-[13px] text-noorix-muted m-0 mb-4 leading-[1.6]">
          {isAr ? reportModal.payload?.messageAr : reportModal.payload?.messageEn || reportModal.payload?.messageAr}
        </p>

            <div className="grid gap-3.5">
              <div>
                <div className="text-[12px] font-extrabold mb-2 text-noorix-muted">
                  {t('backupReportSummary')}
                </div>
                <div className="text-[13px] leading-[1.85]">
                  <div>
                    <strong>{t('backupReportJobId')}:</strong>{' '}
                    <code className="text-[12px]">{reportModal.payload?.jobId}</code>
                  </div>
                  <div>
                    <strong>{t('backupReportScope')}:</strong> {scopeLabel(reportModal.payload?.scope, t)}
                  </div>
                </div>
              </div>

              {reportModal.payload?.meta && (
                <div>
                  <div className="text-[12px] font-extrabold mb-2 text-noorix-muted">
                    {t('backupReportMeta')}
                  </div>
                  <div className="text-[13px] leading-[1.85]">
                    <div>
                      <strong>{t('backupReportExportedAt')}:</strong>{' '}
                      {formatBackupDate(reportModal.payload.meta.exportedAt, lang)}
                    </div>
                    {reportModal.payload.meta.version != null && (
                      <div>
                        <strong>{t('backupReportVersion')}:</strong> {reportModal.payload.meta.version}
                      </div>
                    )}
                    {reportModal.payload.meta.companyId && (
                      <div>
                        <strong>{t('backupReportOriginalCompany')}:</strong>{' '}
                        <code className="text-[11px]">{reportModal.payload.meta.companyId}</code>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {reportModal.payload?.integrity && (
                <div>
                <div className="text-[12px] font-extrabold mb-2 text-noorix-muted">
                  {t('backupReportIntegrity')}
                  </div>
                  <div className="text-[12px] leading-[1.75] break-all">
                    {reportModal.payload.integrity.sizeBytes != null && (
                      <div>
                        <strong>{t('backupReportSizeBytes')}:</strong> {String(reportModal.payload.integrity.sizeBytes)}
                      </div>
                    )}
                    {reportModal.payload.integrity.contentHash && (
                      <div>
                        <strong>{t('backupReportHashLabel')}:</strong> {reportModal.payload.integrity.contentHash}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {reportModal.payload?.counts && (
                <BackupCountsGrid counts={reportModal.payload.counts} t={t} lang={lang} />
              )}

              <details className="text-[12px]">
                <summary className="cursor-pointer font-bold">{t('backupReportRawJson')}</summary>
                <pre className="text-[11px] bg-noorix-bg-muted p-3 overflow-auto nx-ltr mt-2.5 rounded-lg max-h-[220px] text-left">
                  {JSON.stringify(reportModal.payload, null, 2)}
                </pre>
              </details>
            </div>

            <div className="flex items-center justify-end mt-[18px]">
              <Button type="button" variant="primary" onClick={() => setReportModal(null)}>
                {t('close')}
              </Button>
            </div>
          </>
        )}
      </AdaptiveSheet>

      <AdaptiveSheet
        open={!!importReportModal}
        onClose={() => setImportReportModal(null)}
        title={t('backupImportReportTitle')}
        size="md"
        side="start"
        className="backup-import-report-drawer"
      >
        {importReportModal && (
          <>
            <p className="text-[13px] text-noorix-muted m-0 mb-4 leading-[1.6]">
              {t('backupImportOk')}
            </p>

              <div className="grid gap-3.5">
              <div>
                <div className="text-[12px] font-extrabold mb-2 text-noorix-muted">
                  {t('backupReportNewCompany')}
                </div>
                <div className="text-[13px] leading-[1.85]">
                  <div>
                    <strong>{t('backupReportNameAr')}:</strong> {importReportModal.nameAr}
                  </div>
                  {importReportModal.nameEn && (
                    <div>
                      <strong>{t('backupReportNameEn')}:</strong> {importReportModal.nameEn}
                    </div>
                  )}
                  <div>
                    <strong>{t('backupReportNewId')}:</strong>{' '}
                        <code className="text-[11px]">{importReportModal.newCompanyId}</code>
                  </div>
                  {importReportModal.summary?.importedAt && (
                    <div>
                      <strong>{t('backupReportImportedAt')}:</strong>{' '}
                      {formatBackupDate(importReportModal.summary.importedAt, lang)}
                    </div>
                  )}
                </div>
              </div>

              {importReportModal.summary?.sourceMeta &&
                Object.keys(importReportModal.summary.sourceMeta).some((k) => importReportModal.summary.sourceMeta[k] != null) && (
                  <div>
                    <div className="text-[12px] font-extrabold mb-2 text-noorix-muted">
                      {t('backupReportMeta')}
                    </div>
                    <div className="text-[13px] leading-[1.85]">
                      {importReportModal.summary.sourceMeta.exportedAt && (
                        <div>
                          <strong>{t('backupReportExportedAt')}:</strong>{' '}
                          {formatBackupDate(importReportModal.summary.sourceMeta.exportedAt, lang)}
                        </div>
                      )}
                      {importReportModal.summary.sourceMeta.version != null && (
                        <div>
                          <strong>{t('backupReportVersion')}:</strong>{' '}
                          {String(importReportModal.summary.sourceMeta.version)}
                        </div>
                      )}
                      {importReportModal.summary.sourceMeta.originalCompanyId && (
                        <div>
                          <strong>{t('backupReportOriginalCompany')}:</strong>{' '}
                          <code className="text-[11px]">{importReportModal.summary.sourceMeta.originalCompanyId}</code>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {importReportModal.summary?.counts && (
                <BackupCountsGrid counts={importReportModal.summary.counts} t={t} lang={lang} />
              )}

              <details className="text-[12px]">
                <summary className="cursor-pointer font-bold">{t('backupReportRawJson')}</summary>
                <pre className="text-[11px] bg-noorix-bg-muted p-3 overflow-auto nx-ltr mt-2.5 rounded-lg max-h-[220px] text-left">
                  {JSON.stringify(importReportModal, null, 2)}
                </pre>
              </details>
            </div>

            <div className="flex items-center justify-end mt-[18px]">
              <Button type="button" variant="primary" onClick={() => setImportReportModal(null)}>
                {t('close')}
              </Button>
            </div>
          </>
        )}
      </AdaptiveSheet>
    </div>
  );
}

