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
  backupGetCompanyConfig,
  backupPatchCompanyConfig,
  backupRestoreSystemFull,
  backupDownloadSystemJobFile,
  backupUploadSystemFullDump,
} from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useApp } from '../../../context/AppContext';
import {
  Button,
  Input,
  AdaptiveSheet,
  Modal,
  Card,
  ScreenTitle,
  Badge,
  KebabMenu,
  Divider,
} from '../../../ui';
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
          className="flex flex-col gap-1 min-[380px]:flex-row min-[380px]:items-baseline min-[380px]:justify-between min-[380px]:gap-3 text-[13px] py-2 border-b border-noorix-border min-w-0"
        >
          <span className="text-noorix-text min-w-0 break-words">{statLabel(t, key)}</span>
          <span dir="ltr" className="font-semibold tabular-nums shrink-0 min-[380px]:text-end">
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

function statusBadgeColor(status) {
  const m = {
    completed: 'green',
    running: 'blue',
    pending: 'sky',
    failed: 'red',
    skipped_duplicate: 'gray',
  };
  return m[status] || 'gray';
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
  const [coForm, setCoForm] = useState({
    enabled: false,
    scheduleHour: 6,
    scheduleMinute: 0,
    retentionCount: 5,
  });
  const [restoreModal, setRestoreModal] = useState(null);
  const [restorePhrase, setRestorePhrase] = useState('');
  const systemDumpFileRef = React.useRef(null);

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

  const { data: coCfgRes } = useQuery({
    queryKey: ['backup-company-config', companyId],
    queryFn: () => backupGetCompanyConfig(companyId),
    enabled: !!companyId,
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

  React.useEffect(() => {
    if (!coCfgRes?.success || !coCfgRes.data) return;
    const d = coCfgRes.data;
    if (typeof d !== 'object') return;
    const h = Number(d.scheduleHour);
    const m = Number(d.scheduleMinute);
    const r = Number(d.retentionCount);
    setCoForm({
      enabled: !!d.enabled,
      scheduleHour: Number.isFinite(h) ? h : 6,
      scheduleMinute: Number.isFinite(m) ? m : 0,
      retentionCount: Math.min(50, Math.max(1, Number.isFinite(r) ? r : 5)),
    });
  }, [coCfgRes]);

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

  const downloadSysMut = useApiMutation({
    mutationFn: ({ jobId, suggestedName }) => backupDownloadSystemJobFile(jobId, suggestedName),
    successToast: () => t('backupDownloadOk'),
    errorToast: (e) => e?.message || t('backupError'),
  });

  const uploadSysDumpMut = useApiMutation({
    mutationFn: (file) => backupUploadSystemFullDump(file),
    invalidateQueries: [['backup-system-jobs']],
    successToast: (res) =>
      res?.data?.status === 'skipped_duplicate' ? t('backupSystemUploadDup') : t('backupSystemUploadOk'),
    errorToast: (e) => e?.message || t('backupError'),
  });

  const verifyCoMut = useApiMutation({
    mutationFn: (jobId) => backupVerifyCompanyJob(jobId),
    invalidateQueries: [['backup-jobs']],
    successToast: () => t('backupVerifyOk'),
    errorToast: (e) => e?.message || t('backupVerifyBad'),
  });

  const saveCoMut = useApiMutation({
    mutationFn: (body) => backupPatchCompanyConfig(body),
    invalidateQueries: [['backup-company-config', companyId]],
    successToast: () => t('backupSettingsSaved'),
    errorToast: (e) => e?.message || t('backupError'),
  });

  const restoreMut = useApiMutation({
    mutationFn: ({ jobId, confirmPhrase }) => backupRestoreSystemFull(jobId, confirmPhrase),
    successToast: false,
    errorToast: (e) => e?.message || t('backupError'),
    onSuccess: (res) => {
      setRestoreModal(null);
      setRestorePhrase('');
      const msg = res?.data?.messageAr || res?.data?.messageEn || t('backupSystemRestoreOk');
      showToast(msg, 'success');
    },
  });

  React.useEffect(() => {
    if (!companyId && activeCompanies[0]?.id) setCompanyId(activeCompanies[0].id);
  }, [activeCompanies, companyId]);

  return (
    <div className="flex flex-col gap-4 md:gap-5 w-full min-w-0 max-w-full lg:max-w-5xl mx-auto">
      <header className="flex flex-col gap-1 min-w-0">
        <ScreenTitle>{t('backupHeading')}</ScreenTitle>
        <p className="text-[12px] text-noorix-muted m-0 leading-relaxed max-w-2xl">{t('backupIntro')}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 lg:items-stretch min-w-0">
        <section className="min-w-0 flex flex-col gap-0" aria-labelledby="backup-company-title">
          <Card padding="sm" className="flex flex-col gap-4 min-w-0">
            <div className="flex flex-col gap-3 min-w-0">
              <h3 id="backup-company-title" className="text-[14px] font-bold text-noorix-text m-0">
                {t('backupCompanyCardTitle')}
              </h3>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:gap-3 min-w-0">
                <div className="flex-1 min-w-0 w-full">
                  <Input
                    type="select"
                    label={t('backupCompanyPick')}
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
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  className="w-full min-h-[44px] shrink-0 sm:w-auto sm:min-h-[44px]"
                  disabled={!companyId || !activeCompanies.length || triggerMut.isPending}
                  onClick={() => triggerMut.mutate()}
                >
                  {triggerMut.isPending ? t('loading') : t('backupRunNow')}
                </Button>
              </div>
            </div>

            <Divider />

            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 min-w-0">
                <p className="text-[12px] font-semibold text-noorix-text m-0 min-w-0">{t('backupCompanyScheduleTitle')}</p>
                <p className="text-[11px] text-noorix-muted m-0 leading-snug min-w-0 sm:max-w-[min(100%,18rem)] sm:text-end">
                  {t('backupCompanyScheduleHint')}
                </p>
              </div>
              <label className="nx-checkbox flex items-center gap-2.5 text-[13px] font-medium text-noorix-text cursor-pointer select-none py-0.5">
                <input
                  type="checkbox"
                  checked={coForm.enabled}
                  onChange={(e) => setCoForm((p) => ({ ...p, enabled: e.target.checked }))}
                  disabled={!companyId}
                />
                <span>{t('backupCompanyDailyEnabled')}</span>
              </label>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3 min-w-0">
                <div className="flex flex-col gap-1 min-w-0">
                  <label htmlFor="co-backup-h" className="text-[11px] font-bold text-noorix-muted">
                    {t('backupSystemHour')}
                  </label>
                  <Input
                    id="co-backup-h"
                    type="number"
                    min={0}
                    max={23}
                    className="noorix-bank-filter"
                    value={coForm.scheduleHour}
                    onChange={(e) =>
                      setCoForm((p) => ({
                        ...p,
                        scheduleHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)),
                      }))
                    }
                    disabled={!companyId}
                  />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <label htmlFor="co-backup-m" className="text-[11px] font-bold text-noorix-muted">
                    {t('backupSystemMinute')}
                  </label>
                  <Input
                    id="co-backup-m"
                    type="number"
                    min={0}
                    max={59}
                    className="noorix-bank-filter"
                    value={coForm.scheduleMinute}
                    onChange={(e) =>
                      setCoForm((p) => ({
                        ...p,
                        scheduleMinute: Math.min(59, Math.max(0, Number(e.target.value) || 0)),
                      }))
                    }
                    disabled={!companyId}
                  />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <label htmlFor="co-backup-ret" className="text-[11px] font-bold text-noorix-muted">
                    {t('backupCompanyRetention')}
                  </label>
                  <Input
                    id="co-backup-ret"
                    type="number"
                    min={1}
                    max={50}
                    className="noorix-bank-filter"
                    value={coForm.retentionCount}
                    onChange={(e) =>
                      setCoForm((p) => ({
                        ...p,
                        retentionCount: Math.min(50, Math.max(1, Number(e.target.value) || 5)),
                      }))
                    }
                    disabled={!companyId}
                  />
                </div>
              </div>
              {coCfgRes?.success && coCfgRes.data?.lastRunDayRiyadh != null && (
                <p className="text-[11px] text-noorix-muted m-0">
                  {t('backupCompanyLastRun')}: <strong dir="ltr">{coCfgRes.data.lastRunDayRiyadh}</strong>
                </p>
              )}
              <div className="flex justify-stretch sm:justify-end pt-1 sm:pt-0">
                <Button
                  type="button"
                  size="sm"
                  className="w-full min-h-[44px] sm:w-auto"
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

            {!activeCompanies.length && (
              <p className="text-[11px] text-noorix-amber m-0">{t('noActiveCompanies')}</p>
            )}

            <details className="rounded-lg border border-dashed border-noorix-border bg-noorix-bg-muted/50 px-3 py-2.5">
              <summary className="cursor-pointer text-[12px] font-semibold text-noorix-muted list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                <span>{t('backupMoreInfo')}</span>
                <span className="text-noorix-muted opacity-70" aria-hidden>
                  +
                </span>
              </summary>
              <p className="text-[11px] text-noorix-muted mt-2 m-0 leading-relaxed">{t('backupMoreInfoBody')}</p>
            </details>
          </Card>
        </section>

        {canSystemBackup && (
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
                  onChange={(e) => setSysForm((p) => ({ ...p, enabled: e.target.checked }))}
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
                    onChange={(e) =>
                      setSysForm((p) => ({
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
                    onChange={(e) =>
                      setSysForm((p) => ({
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
                <p className="text-[11px] text-noorix-muted m-0">
                  {t('backupSystemLastRun')}: <strong dir="ltr">{sysCfgRes.data.lastRunDayRiyadh}</strong>
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
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
                  disabled={runSysMut.isPending}
                  onClick={() => runSysMut.mutate()}
                >
                  {runSysMut.isPending ? t('loading') : t('backupSystemRunNow')}
                </Button>
              </div>

              <Divider />

              <p className="text-[11px] text-noorix-muted m-0 leading-relaxed min-w-0">{t('backupSystemLocalHint')}</p>
              <div className="flex flex-col gap-2 min-[380px]:flex-row min-[380px]:flex-wrap min-[380px]:items-center">
                <input
                  ref={systemDumpFileRef}
                  type="file"
                  accept=".gz,.dump.gz,application/gzip"
                  className="sr-only"
                  aria-label={t('backupSystemImportFromPc')}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) uploadSysDumpMut.mutate(f);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="w-full min-h-[44px] min-[380px]:w-auto"
                  disabled={uploadSysDumpMut.isPending}
                  onClick={() => systemDumpFileRef.current?.click()}
                >
                  {uploadSysDumpMut.isPending ? t('loading') : t('backupSystemImportFromPc')}
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
                  {(Array.isArray(sysJobsRes?.data) ? sysJobsRes.data : []).map((sj) => (
                    <div
                      key={sj.id}
                      className="flex flex-col gap-3 rounded-lg border border-noorix-border bg-noorix-bg-muted/40 px-3 py-3 min-[520px]:flex-row min-[520px]:items-stretch min-[520px]:justify-between"
                    >
                      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span dir="ltr" className="text-[13px] font-semibold text-noorix-text tabular-nums break-all">
                            {sj.ordinal != null ? `#${sj.ordinal} · ` : ''}
                            {formatBackupDate(sj.createdAt, lang)}
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
                                suggestedName: `noorix-full-db-${sj.ordinal ?? 'na'}-${sj.id}.dump.gz`,
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
                            disabled={restoreMut.isPending}
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
        )}
      </div>

      <section className="flex flex-col gap-3 min-w-0 w-full" aria-labelledby="backup-log-title">
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h3 id="backup-log-title" className="text-[14px] font-bold text-noorix-text m-0 min-w-0">
              {t('backupJobHistory')}
            </h3>
            {!isLoading && jobs.length > 0 && (
              <Badge color="gray" size="sm">
                {jobs.length}
              </Badge>
            )}
          </div>
        </div>
        {isLoading && <p className="text-[12px] text-noorix-muted m-0">{t('loading')}</p>}
        {!isLoading && jobs.length === 0 && <p className="text-[12px] text-noorix-muted m-0">{t('backupNoJobs')}</p>}
        <div className="flex flex-col gap-2 overflow-x-auto min-w-0 -mx-0.5 px-0.5">
          {jobs.map((j) => {
            const metaParts = [
              formatSaudiDateTime(j.createdAt),
              j.sizeBytes != null ? formatFileSize(j.sizeBytes) : '',
              j.durationMs != null ? `${j.durationMs} ms` : '',
              j.externalUploaded ? t('backupExternalOk') : j.externalError ? t('backupExternalPending') : '',
            ].filter(Boolean);
            const title =
              `${scopeLabel(j.scope, t)}${j.company ? ` — ${j.company.nameAr || j.company.nameEn || ''}` : ''}${
                j.ordinal != null ? ` · ${t('backupOrdinalLabel')} ${j.ordinal}` : ''
              }`;
            return (
              <Card key={j.id} padding="sm" className="flex flex-col gap-2.5 min-w-0">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-noorix-text break-words min-w-0">{title}</span>
                    <Badge color={statusBadgeColor(j.status)} size="sm" className="shrink-0">
                      {statusLabel(j.status, t)}
                    </Badge>
                  </div>
                  <div className="shrink-0 pt-0.5 min-h-[44px] min-w-[44px] flex items-start justify-center">
                    <KebabMenu
                      ariaLabel={t('backupActionsMenu')}
                      menuWidth={200}
                      items={[
                    {
                      key: 'report',
                      label: t('backupRestoreReport'),
                      onClick: () => reportMut.mutate(j.id),
                    },
                    {
                      key: 'download',
                      label: t('backupDownload'),
                      hidden: !(j.scope === 'company_logical' && j.status === 'completed' && j.localRelativePath),
                      onClick: () => downloadMut.mutate(j.id),
                    },
                    {
                      key: 'import',
                      label: t('backupImportNewCompany'),
                      hidden: !(j.scope === 'company_logical' && j.status === 'completed' && j.localRelativePath),
                      onClick: () => {
                        setImportNameAr(defaultImportCompanyName(j, t, lang));
                        setImportConfirmed(false);
                        setImportModal({ jobId: j.id });
                      },
                    },
                    {
                      key: 'verify',
                      label: t('backupVerify'),
                      hidden: !(j.scope === 'company_logical' && j.status === 'completed' && j.localRelativePath),
                      onClick: () => verifyCoMut.mutate(j.id),
                    },
                    {
                      key: 'retry',
                      label: t('backupRetryExternal'),
                      hidden: !(!j.externalUploaded && j.status === 'completed' && j.localRelativePath),
                      onClick: () => retryMut.mutate(j.id),
                    },
                  ]}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-noorix-muted m-0 leading-snug break-words">{metaParts.join(' · ')}</p>
                {j.errorMessage && (
                  <p className="text-[11px] text-noorix-red m-0 break-words">{j.errorMessage}</p>
                )}
                {j.verifyOk === true && (
                  <p className="text-[11px] text-noorix-green m-0 font-medium">{t('backupVerifyOk')}</p>
                )}
                {j.verifyOk === false && j.verifyError && (
                  <p className="text-[11px] text-noorix-red m-0 break-words">{j.verifyError}</p>
                )}
              </Card>
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

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={importMut.isPending}
            onClick={() => { setImportModal(null); setImportConfirmed(false); }}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            className="w-full min-h-[44px] sm:w-auto"
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

            <div className="flex justify-stretch sm:justify-end mt-[18px]">
              <Button
                type="button"
                size="sm"
                variant="primary"
                className="w-full min-h-[44px] sm:w-auto"
                onClick={() => setReportModal(null)}
              >
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

            <div className="flex justify-stretch sm:justify-end mt-[18px]">
              <Button
                type="button"
                size="sm"
                variant="primary"
                className="w-full min-h-[44px] sm:w-auto"
                onClick={() => setImportReportModal(null)}
              >
                {t('close')}
              </Button>
            </div>
          </>
        )}
      </AdaptiveSheet>

      <Modal
        open={!!restoreModal}
        onClose={() => !restoreMut.isPending && (setRestoreModal(null), setRestorePhrase(''))}
        title={t('backupSystemRestore')}
        size="md"
        variant="danger"
      >
        <div
          className="text-[13px] font-medium py-[10px] px-[14px] mb-3 rounded-md leading-[1.65] bg-noorix-red/10 border border-noorix-red/45 text-noorix-red"
          role="alert"
        >
          {t('backupSystemRestoreWarn')}
        </div>
        <p className="text-[12px] text-noorix-muted m-0 mb-3 leading-[1.6]">{t('backupSystemRestorePhraseHint')}</p>
        <Input
          type="text"
          label={t('backupSystemRestorePhraseLabel')}
          value={restorePhrase}
          onChange={(e) => setRestorePhrase(e.target.value)}
          className="nx-ltr"
          dir="ltr"
          autoComplete="off"
        />
        <p className="text-[11px] text-noorix-muted mt-2 m-0">{t('backupRestoreExitHint')}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end mt-4">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={restoreMut.isPending}
            onClick={() => (setRestoreModal(null), setRestorePhrase(''))}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={restoreMut.isPending || !restorePhrase.trim()}
            onClick={() =>
              restoreModal &&
              restoreMut.mutate({ jobId: restoreModal.jobId, confirmPhrase: restorePhrase.trim() })
            }
          >
            {restoreMut.isPending ? t('loading') : t('backupSystemRestoreConfirm')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

