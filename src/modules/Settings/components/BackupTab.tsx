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
  BackupCommandCenter,
  BackupSheetsAndModals,
} from './backup';
import { appKeys, settingsKeys } from '../../../services/queryKeys';
import type { ApiParsedResult } from '../../../types/api';
import type {
  BackupConfigData,
  BackupImportModal,
  BackupImportReport,
  BackupJob,
  BackupReportModal,
  BackupReportPayload,
  BackupRestoreModal,
  BackupRestorePcModal,
  BackupSchedulePatch,
  BackupScheduleForm,
  SettingsApiResult,
  SettingsCompany,
} from '../settingsTypes';

type BackupTabProps = {
  activeCompanies?: SettingsCompany[];
};

type ApiDataEnvelope<TData> = {
  data?: TData;
};

type BackupUploadData = { status?: string | null };

type BackupRestoreData = {
  messageAr?: string | null;
  messageEn?: string | null;
};

type BackupUploadResult = ApiParsedResult<BackupUploadData | BackupRestoreData>;
type BackupRestoreResult = ApiParsedResult<BackupUploadData | BackupRestoreData>;

function backupUploadStatus(res: BackupUploadResult): string | null | undefined {
  const data = res.data;
  return data && 'status' in data ? data.status : undefined;
}

function backupRestoreMessage(res: BackupRestoreResult): string | null | undefined {
  const data = res.data;
  if (!data || !('messageAr' in data || 'messageEn' in data)) return undefined;
  return data.messageAr || data.messageEn;
}

export default function BackupTab({ activeCompanies = [] }: BackupTabProps) {
  const { t, lang } = useTranslation();
  const { user, setToken, setUser } = useAuth();
  const canSystemBackup = ['owner', 'super_admin'].includes(String(user?.role || '').toLowerCase());
  const setActiveCompany = useApp()?.setActiveCompany;
  const isAr = lang !== 'en';
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState(() => activeCompanies[0]?.id || '');
  const { showToast } = useToast();
  const [reportModal, setReportModal] = useState<BackupReportModal | null>(null);
  const [importModal, setImportModal] = useState<BackupImportModal | null>(null);
  const [importReportModal, setImportReportModal] = useState<BackupImportReport | null>(null);
  const [importNameAr, setImportNameAr] = useState('');
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [importStrictAlloc, setImportStrictAlloc] = useState(false);
  const [sysForm, setSysForm] = useState<BackupScheduleForm>({
    enabled: false,
    scheduleHour: 6,
    scheduleMinute: 0,
    retentionCount: 10,
    gdriveScriptUrl: '',
    gdriveFolderId: '',
  });
  const [coForm, setCoForm] = useState<BackupScheduleForm>({
    enabled: false,
    scheduleHour: 6,
    scheduleMinute: 0,
    retentionCount: 5,
    gdriveScriptUrl: '',
    gdriveFolderId: '',
  });
  const [restoreModal, setRestoreModal] = useState<BackupRestoreModal | null>(null);
  const [restorePhrase, setRestorePhrase] = useState('');
  const [restorePcModal, setRestorePcModal] = useState<BackupRestorePcModal | null>(null);
  const [restorePcPhrase, setRestorePcPhrase] = useState('');
  const systemArchiveFileRef = React.useRef<HTMLInputElement>(null);
  const restoreFromPcFileRef = React.useRef<HTMLInputElement>(null);

  const { data: jobsData = [], isLoading, isError: jobsIsError, error: jobsError } = useApiListQuery<BackupJob>({
    queryKey: settingsKeys.backupJobs(),
    queryFn: () => backupListJobs(50),
    refetchInterval: 15_000,
    fallbackMessage: t('backupError'),
  });

  const { data: sysCfgData, isError: sysCfgIsError, error: sysCfgError } = useApiQuery<BackupConfigData>({
    queryKey: settingsKeys.backupSystemConfig(),
    queryFn: () => backupGetSystemConfig(),
    enabled: canSystemBackup,
    fallbackMessage: t('backupError'),
  });

  const { data: sysJobsData = [], isLoading: sysJobsLoading, isError: sysJobsIsError, error: sysJobsError } = useApiListQuery<BackupJob>({
    queryKey: settingsKeys.backupSystemJobs(),
    queryFn: () => backupListSystemJobs(15),
    enabled: canSystemBackup,
    refetchInterval: 20_000,
    fallbackMessage: t('backupError'),
  });

  const { data: coCfgData, isError: coCfgIsError, error: coCfgError } = useApiQuery<BackupConfigData>({
    queryKey: settingsKeys.backupCompanyConfig(companyId),
    queryFn: () => backupGetCompanyConfig(companyId),
    enabled: !!companyId,
    fallbackMessage: t('backupError'),
  });

  const jobsRes = React.useMemo<SettingsApiResult<BackupJob[]>>(
    () =>
      jobsIsError
        ? { success: false, error: jobsError?.message || t('backupError') }
        : { success: true, data: jobsData },
    [jobsData, jobsError?.message, jobsIsError, t],
  );
  const sysCfgRes = React.useMemo<SettingsApiResult<BackupConfigData> | undefined>(
    () =>
      sysCfgIsError
        ? { success: false, error: sysCfgError?.message || t('backupError') }
        : (sysCfgData ? { success: true, data: sysCfgData } : undefined),
    [sysCfgData, sysCfgError?.message, sysCfgIsError, t],
  );
  const sysJobsRes = React.useMemo<SettingsApiResult<BackupJob[]>>(
    () =>
      sysJobsIsError
        ? { success: false, error: sysJobsError?.message || t('backupError') }
        : { success: true, data: sysJobsData },
    [sysJobsData, sysJobsError?.message, sysJobsIsError, t],
  );
  const coCfgRes = React.useMemo<SettingsApiResult<BackupConfigData> | undefined>(
    () =>
      coCfgIsError
        ? { success: false, error: coCfgError?.message || t('backupError') }
        : (coCfgData ? { success: true, data: coCfgData } : undefined),
    [coCfgData, coCfgError?.message, coCfgIsError, t],
  );

  React.useEffect(() => {
    if (!sysCfgData) return;
    const d = sysCfgData;
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
  }, [sysCfgData]);

  React.useEffect(() => {
    if (!coCfgData) return;
    const d = coCfgData;
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
  }, [coCfgData]);

  const jobs = jobsRes.success ? jobsRes.data : [];

  const triggerMut = useApiMutation({
    mutationFn: () => backupTriggerCompany(companyId),
    invalidateQueries: [settingsKeys.backupJobs()],
    successToast: () => t('backupStarted'),
    errorToast: (error: Error) => error.message || t('backupError'),
  });

  const reportMut = useApiMutation({
    mutationFn: (jobId: string) => backupRestoreReport(jobId),
    successToast: false,
    showErrorToast: true,
    errorToast: (error: Error) => error.message || t('backupError'),
    onSuccess: (res: ApiDataEnvelope<BackupReportPayload>, jobId: string) => {
      setReportModal({ jobId, payload: res.data });
    },
  });

  const downloadMut = useApiMutation({
    mutationFn: (jobId: string) => backupDownloadJobFile(jobId),
    successToast: () => t('backupDownloadOk'),
    errorToast: (error: Error) => error.message || t('backupError'),
  });

  const importMut = useApiMutation({
    mutationFn: ({ jobId, nameAr, failOnAllocationWarnings }: { jobId: string; nameAr: string; failOnAllocationWarnings: boolean }) =>
      backupImportFromJob({ jobId, nameAr, failOnAllocationWarnings }),
    successToast: false,
    showErrorToast: true,
    errorToast: (error: Error) => error.message || t('backupError'),
    onSuccess: async (res: ApiDataEnvelope<BackupImportReport>) => {
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

  const saveSysMut = useApiMutation({
    mutationFn: (body: BackupSchedulePatch) => backupPatchSystemConfig(body),
    invalidateQueries: [settingsKeys.backupSystemConfig()],
    successToast: () => t('backupSettingsSaved'),
    errorToast: (error: Error) => error.message || t('backupError'),
  });

  const runFullArchiveMut = useApiMutation({
    mutationFn: () => backupRunSystemFullArchive(),
    invalidateQueries: [settingsKeys.backupSystemJobs(), settingsKeys.backupJobs()],
    successToast: () => t('backupStarted'),
    errorToast: (error: Error) => error.message || t('backupError'),
  });

  const verifySysMut = useApiMutation({
    mutationFn: (jobId: string) => backupVerifySystemJob(jobId),
    invalidateQueries: [settingsKeys.backupSystemJobs()],
    successToast: () => t('backupVerifyOk'),
    errorToast: (error: Error) => error.message || t('backupVerifyBad'),
  });

  const downloadSysMut = useApiMutation({
    mutationFn: ({ jobId, suggestedName }: { jobId: string; suggestedName?: string }) => backupDownloadSystemJobFile(jobId, suggestedName),
    successToast: () => t('backupDownloadOk'),
    errorToast: (error: Error) => error.message || t('backupError'),
  });

  const uploadSysArchiveMut = useApiMutation({
    mutationFn: (file: File) => backupUploadSystemFullArchive(file),
    invalidateQueries: [settingsKeys.backupSystemJobs()],
    successToast: (res: BackupUploadResult) =>
      backupUploadStatus(res) === 'skipped_duplicate' ? t('backupSystemUploadDup') : t('backupSystemUploadOk'),
    errorToast: (error: Error) => error.message || t('backupError'),
  });

  const restorePcMut = useApiMutation({
    mutationFn: ({ file, confirmPhrase }: { file: File; confirmPhrase: string }) => backupRestoreSystemFromUpload(file, confirmPhrase),
    invalidateQueries: [settingsKeys.backupSystemJobs(), settingsKeys.backupJobs()],
    successToast: false,
    errorToast: (error: Error) => error.message || t('backupError'),
    onSuccess: (res: BackupRestoreResult) => {
      setRestorePcModal(null);
      setRestorePcPhrase('');
      const msg = backupRestoreMessage(res) || t('backupSystemRestoreOk');
      showToast(msg, 'success');
    },
  });

  const verifyCoMut = useApiMutation({
    mutationFn: (jobId: string) => backupVerifyCompanyJob(jobId),
    invalidateQueries: [settingsKeys.backupJobs()],
    successToast: () => t('backupVerifyOk'),
    errorToast: (error: Error) => error.message || t('backupVerifyBad'),
  });

  const saveCoMut = useApiMutation({
    mutationFn: (body: BackupSchedulePatch & { companyId: string }) => backupPatchCompanyConfig(body),
    invalidateQueries: [settingsKeys.backupCompanyConfig(companyId)],
    successToast: () => t('backupSettingsSaved'),
    errorToast: (error: Error) => error.message || t('backupError'),
  });

  const restoreMut = useApiMutation({
    mutationFn: ({ jobId, confirmPhrase }: { jobId: string; confirmPhrase: string }) => backupRestoreSystemFull(jobId, confirmPhrase),
    successToast: false,
    errorToast: (error: Error) => error.message || t('backupError'),
    onSuccess: (res: BackupRestoreResult) => {
      setRestoreModal(null);
      setRestorePhrase('');
      const msg = backupRestoreMessage(res) || t('backupSystemRestoreOk');
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

      <BackupCommandCenter
        t={t}
        lang={lang}
        canSystemBackup={canSystemBackup}
        activeCompanies={activeCompanies}
        companyId={companyId}
        setCompanyId={setCompanyId}
        coForm={coForm}
        setCoForm={setCoForm}
        coCfgRes={coCfgRes}
        sysForm={sysForm}
        setSysForm={setSysForm}
        sysCfgRes={sysCfgRes}
        isLoading={isLoading}
        jobs={jobs}
        sysJobs={sysJobsRes.success ? sysJobsRes.data : []}
        sysJobsLoading={sysJobsLoading}
        triggerMut={triggerMut}
        saveCoMut={saveCoMut}
        saveSysMut={saveSysMut}
        runFullArchiveMut={runFullArchiveMut}
        reportMut={reportMut}
        downloadMut={downloadMut}
        verifyCoMut={verifyCoMut}
        downloadSysMut={downloadSysMut}
        verifySysMut={verifySysMut}
        restoreMut={restoreMut}
        uploadSysArchiveMut={uploadSysArchiveMut}
        restorePcMut={restorePcMut}
        systemArchiveFileRef={systemArchiveFileRef}
        restoreFromPcFileRef={restoreFromPcFileRef}
        setImportNameAr={setImportNameAr}
        setImportConfirmed={setImportConfirmed}
        setImportModal={setImportModal}
        setRestorePhrase={setRestorePhrase}
        setRestoreModal={setRestoreModal}
        setRestorePcPhrase={setRestorePcPhrase}
        setRestorePcModal={setRestorePcModal}
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

