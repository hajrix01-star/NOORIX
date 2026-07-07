export type SettingsTabId = 'companies' | 'tax' | 'users' | 'roles' | 'backup' | 'ai' | 'branding';

export type SettingsPermission = 'MANAGE_COMPANIES' | 'MANAGE_SETTINGS' | 'MANAGE_USERS';

export type SettingsTabDefinition = {
  id: SettingsTabId;
  label: string;
  permission?: SettingsPermission;
};

export type SettingsCompany = {
  id: string;
  nameAr?: string | null;
  nameEn?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  isArchived?: boolean | null;
  vatEnabledForSales?: boolean | null;
  vatRatePercent?: number | string | null;
};

export type TranslationFn = (key: string, ...args: string[]) => string;

export type BackupJobScope = 'company_logical' | 'database_full' | 'system_full' | string;
export type BackupJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped_duplicate' | string;

export type BackupJobLite = {
  id?: string | null;
  ordinal?: number | string | null;
  scope?: BackupJobScope | null;
  status?: BackupJobStatus | null;
  createdAt?: string | Date | null;
  completedAt?: string | Date | null;
  company?: {
    nameAr?: string | null;
    nameEn?: string | null;
  } | null;
};

export type BackupCounts = Record<string, number | string | null | undefined>;

export type SettingsMutationLike<TVariables> = {
  isPending: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  error?: Error | null;
  mutate: (variables: TVariables) => void;
};

export type SettingsVoidMutationLike = {
  isPending: boolean;
  mutate: () => void;
};

export type SettingsApiResult<TData> =
  | { success: true; data: TData }
  | { success: false; error?: string };

export type BackupScheduleForm = {
  enabled: boolean;
  scheduleHour: number;
  scheduleMinute: number;
  retentionCount: number;
  gdriveScriptUrl: string;
  gdriveFolderId: string;
};

export type BackupSchedulePatch = Pick<
  BackupScheduleForm,
  'enabled' | 'scheduleHour' | 'scheduleMinute' | 'retentionCount'
>;

export type BackupConfigData = Partial<BackupScheduleForm> & {
  lastRunDayRiyadh?: string | null;
};

export type BackupJob = BackupJobLite & {
  id: string;
  sizeBytes?: number | string | null;
  durationMs?: number | string | null;
  localRelativePath?: string | null;
  errorMessage?: string | null;
  verifyOk?: boolean | null;
  verifyError?: string | null;
};

export type BackupReportMeta = {
  exportedAt?: string | Date | null;
  version?: number | string | null;
  companyId?: string | null;
  originalCompanyId?: string | null;
};

export type BackupReportPayload = {
  messageAr?: string | null;
  messageEn?: string | null;
  jobId?: string | null;
  scope?: BackupJobScope | null;
  meta?: BackupReportMeta | null;
  integrity?: {
    sizeBytes?: number | string | null;
    contentHash?: string | null;
  } | null;
  counts?: BackupCounts | null;
};

export type BackupImportSummary = {
  importedAt?: string | Date | null;
  sourceMeta?: BackupReportMeta | null;
  counts?: BackupCounts | null;
  importWarnings?: string[] | null;
};

export type BackupImportReport = {
  nameAr?: string | null;
  nameEn?: string | null;
  newCompanyId?: string | null;
  summary?: BackupImportSummary | null;
};

export type BackupImportModal = { jobId: string };
export type BackupRestoreModal = { jobId: string };
export type BackupRestorePcModal = { file: File };
export type BackupReportModal = { jobId: string; payload?: BackupReportPayload | null };

export type BackupImportVariables = {
  jobId: string;
  nameAr: string;
  failOnAllocationWarnings: boolean;
};

export type BackupSystemDownloadVariables = {
  jobId: string;
  suggestedName?: string;
};

export type BackupRestoreVariables = {
  jobId: string;
  confirmPhrase: string;
};

export type BackupRestorePcVariables = {
  file: File;
  confirmPhrase: string;
};
