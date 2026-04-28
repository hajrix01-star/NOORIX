/**
 * مفاتيح React Query — إعدادات النظام، مستخدمين، أدوار، نسخ احتياطي
 */
export const settingsKeys = {
  users: () => ['users'] as const,

  roles: () => ['roles'] as const,

  permissionsSchema: () => ['permissions-schema'] as const,

  healthAiSettings: () => ['health', 'ai-settings'] as const,

  backupJobs: () => ['backup-jobs'] as const,

  backupSystemConfig: () => ['backup-system-config'] as const,

  backupSystemJobs: () => ['backup-system-jobs'] as const,

  backupCompanyConfig: (companyId: string) => ['backup-company-config', companyId] as const,
};
