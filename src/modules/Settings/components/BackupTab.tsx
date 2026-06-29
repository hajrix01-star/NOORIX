/**
 * النسخ الاحتياطي — لقطة منطقية لكل شركة، سجل، تقرير استرجاع، إعادة رفع خارجي
 */
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useApiListQuery, useApiQuery } from '../../../hooks/useApiQuery';
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
  backupRunSystemFullArchive,
  backupVerifySystemJob,
  backupVerifyCompanyJob,
  backupGetCompanyConfig,
  backupPatchCompanyConfig,
  backupRestoreSystemFull,
  backupDownloadSystemJobFile,
  backupUploadSystemFullArchive,
  backupRestoreSystemFromUpload,
} from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useApp } from '../../../context/AppContext';
import { ScreenTitle } from '../../../ui';
import {
  BackupCompanySection,
  BackupSystemSection,
  BackupJobsHistory,
  BackupSheetsAndModals,
} from './backup';
import { appKeys, settingsKeys } from '../../../services/queryKeys';

export default function BackupTab({ activeCompanies = [] }: any) {
  const { t, lang } = useTranslation();
  const { user, setToken, setUser } = useAuth();
  const canSystemBackup = ['owner', 'super_admin'].includes(String(user?.role || '').toLowerCase());
  const setActiveCompany = useApp()?.setActiveCompany;
  const isAr = lang !== 'en';
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState(() => activeCompanies[0]?.id || '');
  const { showToast } = useToast();
  const [reportModal, setReportModal] = useState<any>(null);
  const [importModal, setImportModal] = useState<any>(null);
  const [importReportModal, setImportReportModal] = useState<any>(null);
  const [importNameAr, setImportNameAr] = useState('');
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [importStrictAlloc, setImportStrictAlloc] = useState(false);
  const [sysForm, setSysForm] = useState({
    enabled: false,
    scheduleHour: 6,
    scheduleMinute: 0,
    retentionCount: 10,
    gdriveScriptUrl: '',
    gdriveFolderId: '',
  });
  const [coForm, setCoForm] = useState({
    enabled: false,
    scheduleHour: 6,
    scheduleMinute: 0,
    retentionCount: 5,
    gdriveScriptUrl: '',
    gdriveFolderId: '',
  });
  const [restoreModal, setRestoreModal] = useState<any>(null);
  const [restorePhrase, setRestorePhrase] = useState('');
  const [restorePcModal, setRestorePcModal] = useState<any>(null);
  const [restorePcPhrase, setRestorePcPhrase] = useState('');
  const systemArchiveFileRef = React.useRef<any>(null);
  const restoreFromPcFileRef = React.useRef<any>(null);

  const { data: jobsData = [], isLoading, isError: jobsIsError, error: jobsError } = useApiListQuery<any>({
    queryKey: settingsKeys.backupJobs(),
    queryFn: () => backupListJobs(50),
    refetchInterval: 15_000,
    fallbackMessage: t('backupError'),
  });

  const { data: sysCfgData, isError: sysCfgIsError, error: sysCfgError } = useApiQuery<any>({
    queryKey: settingsKeys.backupSystemConfig(),
    queryFn: () => backupGetSystemConfig(),
    enabled: canSystemBackup,
    fallbackMessage: t('backupError'),
  });

  const { data: sysJobsData = [], isLoading: sysJobsLoading, isError: sysJobsIsError, error: sysJobsError } = useApiListQuery<any>({
    queryKey: settingsKeys.backupSystemJobs(),
    queryFn: () => backupListSystemJobs(15),
    enabled: canSystemBackup,
    refetchInterval: 20_000,
    fallbackMessage: t('backupError'),
  });

  const { data: coCfgData, isError: coCfgIsError, error: coCfgError } = useApiQuery<any>({
    queryKey: settingsKeys.backupCompanyConfig(companyId),
    queryFn: () => backupGetCompanyConfig(companyId),
    enabled: !!companyId,
    fallbackMessage: t('backupError'),
  });

  const jobsRes = jobsIsError
    ? { success: false, error: jobsError?.message || t('backupError') }
    : { success: true, data: jobsData };
  const sysCfgRes = sysCfgIsError
    ? { success: false, error: sysCfgError?.message || t('backupError') }
    : (sysCfgData ? { success: true, data: sysCfgData } : undefined);
  const sysJobsRes = sysJobsIsError
    ? { success: false, error: sysJobsError?.message || t('backupError') }
    : { success: true, data: sysJobsData };
  const coCfgRes = coCfgIsError
    ? { success: false, error: coCfgError?.message || t('backupError') }
    : (coCfgData ? { success: true, data: coCfgData } : undefined);

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
      gdriveScriptUrl: typeof d.gdriveScriptUrl === 'string' ? d.gdriveScriptUrl : '',
      gdriveFolderId: typeof d.gdriveFolderId === 'string' ? d.gdriveFolderId : '',
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
      gdriveScriptUrl: typeof d.gdriveScriptUrl === 'string' ? d.gdriveScriptUrl : '',
      gdriveFolderId: typeof d.gdriveFolderId === 'string' ? d.gdriveFolderId : '',
    });
  }, [coCfgRes]);

  const jobs = jobsRes?.success ? (Array.isArray(jobsRes.data) ? jobsRes.data : []) : [];

  const triggerMut = useApiMutation({
    mutationFn: () => backupTriggerCompany(companyId),
    invalidateQueries: [settingsKeys.backupJobs()],
    successToast: () => t('backupStarted'),
    errorToast: (e: any) => e?.message || t('backupError'),
  });

  const reportMut = useApiMutation({
    mutationFn: (jobId: any) => backupRestoreReport(jobId),
    successToast: false,
    showErrorToast: true,
    errorToast: (e: any) => e?.message || t('backupError'),
    onSuccess: (res: any, jobId: any) => {
      setReportModal({ jobId, payload: res.data });
    },
  });

  const downloadMut = useApiMutation({
    mutationFn: (jobId: any) => backupDownloadJobFile(jobId),
    successToast: () => t('backupDownloadOk'),
    errorToast: (e: any) => e?.message || t('backupError'),
  });

  const importMut = useApiMutation({
    mutationFn: ({ jobId, nameAr, failOnAllocationWarnings }: any) =>
      backupImportFromJob({ jobId, nameAr, failOnAllocationWarnings }),
    successToast: false,
    showErrorToast: true,
    errorToast: (e: any) => e?.message || t('backupError'),
    onSuccess: async (res: any) => {
      setImportModal(null);
      setImportNameAr('');
      setImportStrictAlloc(false);
      const ref = await refreshAuthSession();
      if (ref.success && ref.data?.access_token) {
        setToken(ref.data.access_token);
        if (ref.data.user) setUser(ref.data.user);
      }
      await qc.invalidateQueries({ queryKey: settingsKeys.backupJobs() });
      await Promise.all([
        qc.refetchQueries({ queryKey: appKeys.companiesRoot() }),
        qc.refetchQueries({ queryKey: appKeys.companies(false) }),
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
    mutationFn: (jobId: any) => backupRetryExternal(jobId),
    invalidateQueries: [settingsKeys.backupJobs()],
    successToast: () => t('backupRetryOk'),
    errorToast: (e: any) => e?.message || t('backupError'),
  });

  const saveSysMut = useApiMutation({
    mutationFn: (body: any) => backupPatchSystemConfig(body),
    invalidateQueries: [settingsKeys.backupSystemConfig()],
    successToast: () => t('backupSettingsSaved'),
    errorToast: (e: any) => e?.message || t('backupError'),
  });

  const runFullArchiveMut = useApiMutation({
    mutationFn: () => backupRunSystemFullArchive(),
    invalidateQueries: [settingsKeys.backupSystemJobs(), settingsKeys.backupJobs()],
    successToast: () => t('backupStarted'),
    errorToast: (e: any) => e?.message || t('backupError'),
  });

  const verifySysMut = useApiMutation({
    mutationFn: (jobId: any) => backupVerifySystemJob(jobId),
    invalidateQueries: [settingsKeys.backupSystemJobs()],
    successToast: () => t('backupVerifyOk'),
    errorToast: (e: any) => e?.message || t('backupVerifyBad'),
  });

  const downloadSysMut = useApiMutation({
    mutationFn: ({ jobId, suggestedName }: any) => backupDownloadSystemJobFile(jobId, suggestedName),
    successToast: () => t('backupDownloadOk'),
    errorToast: (e: any) => e?.message || t('backupError'),
  });

  const uploadSysArchiveMut = useApiMutation({
    mutationFn: (file: any) => backupUploadSystemFullArchive(file),
    invalidateQueries: [settingsKeys.backupSystemJobs()],
    successToast: (res: any) =>
      res?.data?.status === 'skipped_duplicate' ? t('backupSystemUploadDup') : t('backupSystemUploadOk'),
    errorToast: (e: any) => e?.message || t('backupError'),
  });

  const restorePcMut = useApiMutation({
    mutationFn: ({ file, confirmPhrase }: any) => backupRestoreSystemFromUpload(file, confirmPhrase),
    invalidateQueries: [settingsKeys.backupSystemJobs(), settingsKeys.backupJobs()],
    successToast: false,
    errorToast: (e: any) => e?.message || t('backupError'),
    onSuccess: (res: any) => {
      setRestorePcModal(null);
      setRestorePcPhrase('');
      const msg = res?.data?.messageAr || res?.data?.messageEn || t('backupSystemRestoreOk');
      showToast(msg, 'success');
    },
  });

  const verifyCoMut = useApiMutation({
    mutationFn: (jobId: any) => backupVerifyCompanyJob(jobId),
    invalidateQueries: [settingsKeys.backupJobs()],
    successToast: () => t('backupVerifyOk'),
    errorToast: (e: any) => e?.message || t('backupVerifyBad'),
  });

  const saveCoMut = useApiMutation({
    mutationFn: (body: any) => backupPatchCompanyConfig(body),
    invalidateQueries: [settingsKeys.backupCompanyConfig(companyId)],
    successToast: () => t('backupSettingsSaved'),
    errorToast: (e: any) => e?.message || t('backupError'),
  });

  const restoreMut = useApiMutation({
    mutationFn: ({ jobId, confirmPhrase }: any) => backupRestoreSystemFull(jobId, confirmPhrase),
    successToast: false,
    errorToast: (e: any) => e?.message || t('backupError'),
    onSuccess: (res: any) => {
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
        <BackupCompanySection
          t={t}
          activeCompanies={activeCompanies}
          companyId={companyId}
          setCompanyId={setCompanyId}
          coForm={coForm}
          setCoForm={setCoForm}
          coCfgRes={coCfgRes}
          triggerMut={triggerMut}
          saveCoMut={saveCoMut}
        />

        {canSystemBackup && (
          <BackupSystemSection
            t={t}
            lang={lang}
            sysForm={sysForm}
            setSysForm={setSysForm}
            sysCfgRes={sysCfgRes}
            saveSysMut={saveSysMut}
            runFullArchiveMut={runFullArchiveMut}
            systemArchiveFileRef={systemArchiveFileRef}
            restoreFromPcFileRef={restoreFromPcFileRef}
            uploadSysArchiveMut={uploadSysArchiveMut}
            restorePcMut={restorePcMut}
            setRestorePcPhrase={setRestorePcPhrase}
            setRestorePcModal={setRestorePcModal}
            sysJobsLoading={sysJobsLoading}
            sysJobsRes={sysJobsRes}
            downloadSysMut={downloadSysMut}
            verifySysMut={verifySysMut}
            restoreMut={restoreMut}
            setRestorePhrase={setRestorePhrase}
            setRestoreModal={setRestoreModal}
          />
        )}
      </div>

      <BackupJobsHistory
        t={t}
        lang={lang}
        isLoading={isLoading}
        jobs={jobs}
        reportMut={reportMut}
        downloadMut={downloadMut}
        verifyCoMut={verifyCoMut}
        retryMut={retryMut}
        setImportNameAr={setImportNameAr}
        setImportConfirmed={setImportConfirmed}
        setImportModal={setImportModal}
      />

      <BackupSheetsAndModals
        t={t}
        lang={lang}
        isAr={isAr}
        importModal={importModal}
        setImportModal={setImportModal}
        importMut={importMut}
        importNameAr={importNameAr}
        setImportNameAr={setImportNameAr}
        importConfirmed={importConfirmed}
        setImportConfirmed={setImportConfirmed}
        importStrictAlloc={importStrictAlloc}
        setImportStrictAlloc={setImportStrictAlloc}
        reportModal={reportModal}
        setReportModal={setReportModal}
        importReportModal={importReportModal}
        setImportReportModal={setImportReportModal}
        restorePcModal={restorePcModal}
        setRestorePcModal={setRestorePcModal}
        restorePcPhrase={restorePcPhrase}
        setRestorePcPhrase={setRestorePcPhrase}
        restorePcMut={restorePcMut}
        restoreModal={restoreModal}
        setRestoreModal={setRestoreModal}
        restorePhrase={restorePhrase}
        setRestorePhrase={setRestorePhrase}
        restoreMut={restoreMut}
      />
    </div>
  );
}

