/**
 * النسخ الاحتياطي — لقطة منطقية لكل شركة، سجل، تقرير استرجاع، إعادة رفع خارجي
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import Toast from '../../../components/Toast';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';

function formatBackupDate(iso, lang) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'ar-SA');
  } catch {
    return String(iso);
  }
}

/** اسم افتراضي للاستيراد: شركة — تاريخ النسخة — #رقم */
function defaultImportCompanyName(j, t, lang) {
  const co = j.company?.nameAr || t('backupImportDefaultCo');
  const raw = j.completedAt || j.createdAt;
  let dateStr = '—';
  if (raw) {
    try {
      dateStr = new Date(raw).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-SA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
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
      <p style={{ margin: 0, fontSize: 13, color: 'var(--noorix-text-muted)' }}>—</p>
    );
  }
  const total = rows.reduce((s, [, n]) => s + (Number(n) || 0), 0);
  return (
    <div style={{ display: 'grid', gap: 0 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--noorix-text-muted)' }}>
          {t('backupReportCounts')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 4 }}>
          {t('backupReportTotalRows')}:{' '}
          <strong dir="ltr">{total.toLocaleString(lang === 'en' ? 'en-GB' : 'ar-SA')}</strong>
        </div>
      </div>
      {rows.map(([key, val]) => (
        <div
          key={key}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 8,
            padding: '6px 0',
            fontSize: 13,
            borderBottom: '1px solid var(--noorix-border)',
            alignItems: 'baseline',
          }}
        >
          <span style={{ color: 'var(--noorix-text)' }}>{statLabel(t, key)}</span>
          <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {Number(val).toLocaleString(lang === 'en' ? 'en-GB' : 'ar-SA')}
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
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [reportModal, setReportModal] = useState(null);
  const [importModal, setImportModal] = useState(null);
  const [importReportModal, setImportReportModal] = useState(null);
  const [importNameAr, setImportNameAr] = useState('');
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

  const triggerMut = useMutation({
    mutationFn: () => backupTriggerCompany(companyId),
    onSuccess: (res) => {
      if (!res?.success) {
        setToast({ visible: true, message: res?.error || t('backupError'), type: 'error' });
        return;
      }
      qc.invalidateQueries({ queryKey: ['backup-jobs'] });
      setToast({ visible: true, message: t('backupStarted'), type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('backupError'), type: 'error' }),
  });

  const reportMut = useMutation({
    mutationFn: (jobId) => backupRestoreReport(jobId),
    onSuccess: (res, jobId) => {
      if (!res?.success) {
        setToast({ visible: true, message: res?.error || t('backupError'), type: 'error' });
        return;
      }
      setReportModal({ jobId, payload: res.data });
    },
  });

  const downloadMut = useMutation({
    mutationFn: async (jobId) => {
      const r = await backupDownloadJobFile(jobId);
      if (!r?.success) throw new Error(r?.error || 'download failed');
      return r;
    },
    onSuccess: () => setToast({ visible: true, message: t('backupDownloadOk'), type: 'success' }),
    onError: (e) => setToast({ visible: true, message: e?.message || t('backupError'), type: 'error' }),
  });

  const importMut = useMutation({
    mutationFn: ({ jobId, nameAr }) => backupImportFromJob({ jobId, nameAr }),
    onSuccess: async (res) => {
      if (!res?.success) {
        setToast({ visible: true, message: res?.error || t('backupError'), type: 'error' });
        return;
      }
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
      setToast({
        visible: true,
        message: ref.success ? t('backupImportOk') : `${t('backupImportOk')} — ${t('backupImportSessionHint')}`,
        type: ref.success ? 'success' : 'error',
      });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('backupError'), type: 'error' }),
  });

  const retryMut = useMutation({
    mutationFn: (jobId) => backupRetryExternal(jobId),
    onSuccess: (res) => {
      if (!res?.success) {
        setToast({ visible: true, message: res?.error || t('backupError'), type: 'error' });
        return;
      }
      qc.invalidateQueries({ queryKey: ['backup-jobs'] });
      setToast({ visible: true, message: t('backupRetryOk'), type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('backupError'), type: 'error' }),
  });

  const saveSysMut = useMutation({
    mutationFn: (body) => backupPatchSystemConfig(body),
    onSuccess: (res) => {
      if (!res?.success) {
        setToast({ visible: true, message: res?.error || t('backupError'), type: 'error' });
        return;
      }
      qc.invalidateQueries({ queryKey: ['backup-system-config'] });
      setToast({ visible: true, message: t('backupSettingsSaved'), type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('backupError'), type: 'error' }),
  });

  const runSysMut = useMutation({
    mutationFn: () => backupRunSystemNow(),
    onSuccess: (res) => {
      if (!res?.success) {
        setToast({ visible: true, message: res?.error || t('backupError'), type: 'error' });
        return;
      }
      qc.invalidateQueries({ queryKey: ['backup-system-jobs'] });
      qc.invalidateQueries({ queryKey: ['backup-jobs'] });
      setToast({ visible: true, message: t('backupStarted'), type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('backupError'), type: 'error' }),
  });

  const verifySysMut = useMutation({
    mutationFn: (jobId) => backupVerifySystemJob(jobId),
    onSuccess: (res) => {
      if (!res?.success) {
        setToast({ visible: true, message: res?.error || t('backupVerifyBad'), type: 'error' });
        return;
      }
      qc.invalidateQueries({ queryKey: ['backup-system-jobs'] });
      setToast({ visible: true, message: t('backupVerifyOk'), type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('backupVerifyBad'), type: 'error' }),
  });

  const verifyCoMut = useMutation({
    mutationFn: (jobId) => backupVerifyCompanyJob(jobId),
    onSuccess: (res) => {
      if (!res?.success) {
        setToast({ visible: true, message: res?.error || t('backupVerifyBad'), type: 'error' });
        return;
      }
      qc.invalidateQueries({ queryKey: ['backup-jobs'] });
      setToast({ visible: true, message: t('backupVerifyOk'), type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('backupVerifyBad'), type: 'error' }),
  });

  React.useEffect(() => {
    if (!companyId && activeCompanies[0]?.id) setCompanyId(activeCompanies[0].id);
  }, [activeCompanies, companyId]);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div>
        <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800 }}>{t('backupHeading')}</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--noorix-text-muted)', lineHeight: 1.65 }}>
          {t('backupIntro')}
        </p>
      </div>

      <div
        className="noorix-surface-card"
        style={{ padding: 18, display: 'grid', gap: 14, border: '1px solid var(--noorix-border)' }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--noorix-text)' }}>{t('backupCompanySection')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <select
            className="noorix-bank-filter"
            style={{ minWidth: 220 }}
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            disabled={!activeCompanies.length}
          >
            {activeCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr || c.nameEn || c.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="noorix-btn noorix-btn--primary noorix-bank-cta"
            disabled={!companyId || !activeCompanies.length || triggerMut.isPending}
            onClick={() => triggerMut.mutate()}
          >
            {triggerMut.isPending ? t('loading') : t('backupRunNow')}
          </button>
        </div>
        {!activeCompanies.length && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('noActiveCompanies')}</p>
        )}
        <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 12, color: 'var(--noorix-text-muted)', lineHeight: 1.7 }}>
          <li>{t('backupBulletDedup')}</li>
          <li>{t('backupBulletExternal')}</li>
          <li>{t('backupBulletResume')}</li>
          <li>{t('backupBulletReport')}</li>
          <li>{t('backupBulletDaily')}</li>
        </ul>
      </div>

      {canSystemBackup && (
        <div
          className="noorix-surface-card"
          style={{ padding: 18, display: 'grid', gap: 14, border: '1px solid var(--noorix-border)' }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--noorix-text)' }}>{t('backupSystemHeading')}</div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--noorix-text-muted)', lineHeight: 1.65 }}>
            {t('backupSystemIntro')}
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={sysForm.enabled}
              onChange={(e) => setSysForm((p) => ({ ...p, enabled: e.target.checked }))}
            />
            {t('backupSystemEnabled')}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--noorix-text-muted)' }}>
                {t('backupSystemHour')}
              </div>
              <input
                type="number"
                min={0}
                max={23}
                className="noorix-bank-filter"
                style={{ width: 72 }}
                value={sysForm.scheduleHour}
                onChange={(e) =>
                  setSysForm((p) => ({ ...p, scheduleHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)) }))
                }
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--noorix-text-muted)' }}>
                {t('backupSystemMinute')}
              </div>
              <input
                type="number"
                min={0}
                max={59}
                className="noorix-bank-filter"
                style={{ width: 72 }}
                value={sysForm.scheduleMinute}
                onChange={(e) =>
                  setSysForm((p) => ({ ...p, scheduleMinute: Math.min(59, Math.max(0, Number(e.target.value) || 0)) }))
                }
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--noorix-text-muted)' }}>
                {t('backupSystemRetention')}
              </div>
              <input
                type="number"
                min={1}
                max={50}
                className="noorix-bank-filter"
                style={{ width: 72 }}
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
            <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>
              {t('backupSystemLastRun')}: <strong dir="ltr">{sysCfgRes.data.lastRunDayRiyadh}</strong>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="noorix-btn noorix-btn--secondary"
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
            </button>
            <button
              type="button"
              className="noorix-btn noorix-btn--primary"
              disabled={runSysMut.isPending}
              onClick={() => runSysMut.mutate()}
            >
              {runSysMut.isPending ? t('loading') : t('backupSystemRunNow')}
            </button>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>{t('backupSystemJobs')}</div>
          {sysJobsLoading && <div style={{ color: 'var(--noorix-text-muted)' }}>{t('loading')}</div>}
          {!sysJobsLoading && (!sysJobsRes?.success || !(Array.isArray(sysJobsRes.data) ? sysJobsRes.data : []).length) && (
            <div style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>{t('backupSystemNoJobs')}</div>
          )}
          <div style={{ display: 'grid', gap: 8 }}>
            {(Array.isArray(sysJobsRes?.data) ? sysJobsRes.data : []).map((sj) => (
              <div
                key={sj.id}
                className="noorix-surface-card"
                style={{
                  padding: 10,
                  fontSize: 12,
                  border: '1px solid var(--noorix-border)',
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
                  <span dir="ltr" style={{ fontWeight: 700 }}>
                    {sj.ordinal != null ? `#${sj.ordinal} · ` : ''}
                    {formatBackupDate(sj.createdAt, lang)}
                  </span>
                  <span>{statusLabel(sj.status, t)}</span>
                </div>
                {sj.verifyOk === true && (
                  <span style={{ color: '#15803d', fontSize: 11 }}>{t('backupVerifyOk')}</span>
                )}
                {sj.verifyOk === false && sj.verifyError && (
                  <span style={{ color: '#b91c1c', fontSize: 11 }}>{sj.verifyError}</span>
                )}
                {sj.status === 'completed' && sj.localRelativePath && (
                  <button
                    type="button"
                    className="noorix-btn noorix-btn--ghost"
                    style={{ alignSelf: 'flex-start' }}
                    disabled={verifySysMut.isPending}
                    onClick={() => verifySysMut.mutate(sj.id)}
                  >
                    {t('backupVerify')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t('backupJobHistory')}</div>
        {isLoading && <div style={{ color: 'var(--noorix-text-muted)' }}>{t('loading')}</div>}
        {!isLoading && jobs.length === 0 && (
          <div style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>{t('backupNoJobs')}</div>
        )}
        <div style={{ display: 'grid', gap: 8 }}>
          {jobs.map((j) => (
            <div
              key={j.id}
              className="noorix-surface-card"
              style={{
                padding: 12,
                display: 'grid',
                gap: 8,
                fontSize: 13,
                border: '1px solid var(--noorix-border)',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700 }}>
                  {scopeLabel(j.scope, t)}
                  {j.company ? ` — ${j.company.nameAr || j.company.nameEn || ''}` : ''}
                  {j.ordinal != null ? ` · ${t('backupOrdinalLabel')} ${j.ordinal}` : ''}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 8,
                    background: 'var(--noorix-bg-muted)',
                  }}
                >
                  {statusLabel(j.status, t)}
                </span>
              </div>
              <div style={{ color: 'var(--noorix-text-muted)', fontSize: 12 }}>
                {new Date(j.createdAt).toLocaleString(isAr ? 'ar-SA' : 'en-GB')}
                {j.sizeBytes != null ? ` · ${(Number(j.sizeBytes) / 1024).toFixed(1)} KB` : ''}
                {j.durationMs != null ? ` · ${j.durationMs} ms` : ''}
                {j.externalUploaded ? ` · ${t('backupExternalOk')}` : j.externalError ? ` · ${t('backupExternalPending')}` : ''}
              </div>
              {j.errorMessage && (
                <div style={{ color: '#b91c1c', fontSize: 12 }}>{j.errorMessage}</div>
              )}
              {j.verifyOk === true && (
                <div style={{ color: '#15803d', fontSize: 11 }}>{t('backupVerifyOk')}</div>
              )}
              {j.verifyOk === false && j.verifyError && (
                <div style={{ color: '#b91c1c', fontSize: 11 }}>{j.verifyError}</div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  className="noorix-btn noorix-btn--secondary"
                  disabled={reportMut.isPending}
                  onClick={() => reportMut.mutate(j.id)}
                >
                  {t('backupRestoreReport')}
                </button>
                {j.scope === 'company_logical' && j.status === 'completed' && j.localRelativePath && (
                  <>
                    <button
                      type="button"
                      className="noorix-btn noorix-btn--secondary"
                      disabled={downloadMut.isPending}
                      onClick={() => downloadMut.mutate(j.id)}
                    >
                      {t('backupDownload')}
                    </button>
                    <button
                      type="button"
                      className="noorix-btn noorix-btn--primary"
                      disabled={importMut.isPending}
                      onClick={() => {
                        setImportNameAr(defaultImportCompanyName(j, t, lang));
                        setImportModal({ jobId: j.id });
                      }}
                    >
                      {t('backupImportNewCompany')}
                    </button>
                  </>
                )}
                {j.scope === 'company_logical' && j.status === 'completed' && j.localRelativePath && (
                  <button
                    type="button"
                    className="noorix-btn noorix-btn--ghost"
                    disabled={verifyCoMut.isPending}
                    onClick={() => verifyCoMut.mutate(j.id)}
                  >
                    {t('backupVerify')}
                  </button>
                )}
                {!j.externalUploaded && j.status === 'completed' && j.localRelativePath && (
                  <button
                    type="button"
                    className="noorix-btn noorix-btn--ghost"
                    disabled={retryMut.isPending}
                    onClick={() => retryMut.mutate(j.id)}
                  >
                    {t('backupRetryExternal')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {importModal && (
        <div
          className="noorix-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => e.target === e.currentTarget && !importMut.isPending && setImportModal(null)}
        >
          <div
            className="noorix-surface-card"
            style={{ maxWidth: 440, width: '100%', padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>{t('backupImportNewCompany')}</h3>
            <p style={{ fontSize: 13, color: 'var(--noorix-text-muted)', lineHeight: 1.6 }}>
              {t('backupImportWarn')}
            </p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              {t('backupImportNameLabel')}
            </label>
            <input
              type="text"
              className="noorix-bank-filter"
              style={{ width: '100%', marginBottom: 16 }}
              value={importNameAr}
              onChange={(e) => setImportNameAr(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="noorix-btn noorix-btn--ghost"
                disabled={importMut.isPending}
                onClick={() => setImportModal(null)}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="noorix-btn noorix-btn--primary"
                disabled={importMut.isPending || !importNameAr.trim()}
                onClick={() =>
                  importMut.mutate({ jobId: importModal.jobId, nameAr: importNameAr.trim() })
                }
              >
                {importMut.isPending ? t('loading') : t('backupImportRun')}
              </button>
            </div>
          </div>
        </div>
      )}

      {reportModal && (
        <div
          className="noorix-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => e.target === e.currentTarget && setReportModal(null)}
        >
          <div
            className="noorix-surface-card"
            style={{ maxWidth: 560, width: '100%', maxHeight: '88vh', overflow: 'auto', padding: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>{t('backupRestoreReport')}</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--noorix-text-muted)', lineHeight: 1.6 }}>
              {isAr ? reportModal.payload?.messageAr : reportModal.payload?.messageEn || reportModal.payload?.messageAr}
            </p>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: 'var(--noorix-text-muted)' }}>
                  {t('backupReportSummary')}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.85 }}>
                  <div>
                    <strong>{t('backupReportJobId')}:</strong>{' '}
                    <code style={{ fontSize: 12 }}>{reportModal.payload?.jobId}</code>
                  </div>
                  <div>
                    <strong>{t('backupReportScope')}:</strong> {scopeLabel(reportModal.payload?.scope, t)}
                  </div>
                </div>
              </div>

              {reportModal.payload?.meta && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: 'var(--noorix-text-muted)' }}>
                    {t('backupReportMeta')}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.85 }}>
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
                        <code style={{ fontSize: 11 }}>{reportModal.payload.meta.companyId}</code>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {reportModal.payload?.integrity && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: 'var(--noorix-text-muted)' }}>
                    {t('backupReportIntegrity')}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.75, wordBreak: 'break-all' }}>
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

              <details style={{ fontSize: 12 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{t('backupReportRawJson')}</summary>
                <pre
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    background: 'var(--noorix-bg-muted)',
                    padding: 12,
                    borderRadius: 10,
                    overflow: 'auto',
                    maxHeight: 220,
                    direction: 'ltr',
                    textAlign: 'left',
                  }}
                >
                  {JSON.stringify(reportModal.payload, null, 2)}
                </pre>
              </details>
            </div>

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="noorix-btn noorix-btn--primary" onClick={() => setReportModal(null)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {importReportModal && (
        <div
          className="noorix-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1410,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => e.target === e.currentTarget && setImportReportModal(null)}
        >
          <div
            className="noorix-surface-card"
            style={{ maxWidth: 560, width: '100%', maxHeight: '88vh', overflow: 'auto', padding: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>{t('backupImportReportTitle')}</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--noorix-text-muted)', lineHeight: 1.6 }}>
              {t('backupImportOk')}
            </p>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: 'var(--noorix-text-muted)' }}>
                  {t('backupReportNewCompany')}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.85 }}>
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
                    <code style={{ fontSize: 11 }}>{importReportModal.newCompanyId}</code>
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
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: 'var(--noorix-text-muted)' }}>
                      {t('backupReportMeta')}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.85 }}>
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
                          <code style={{ fontSize: 11 }}>{importReportModal.summary.sourceMeta.originalCompanyId}</code>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {importReportModal.summary?.counts && (
                <BackupCountsGrid counts={importReportModal.summary.counts} t={t} lang={lang} />
              )}

              <details style={{ fontSize: 12 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{t('backupReportRawJson')}</summary>
                <pre
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    background: 'var(--noorix-bg-muted)',
                    padding: 12,
                    borderRadius: 10,
                    overflow: 'auto',
                    maxHeight: 220,
                    direction: 'ltr',
                    textAlign: 'left',
                  }}
                >
                  {JSON.stringify(importReportModal, null, 2)}
                </pre>
              </details>
            </div>

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="noorix-btn noorix-btn--primary" onClick={() => setImportReportModal(null)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((p) => ({ ...p, visible: false }))}
      />
    </div>
  );
}
