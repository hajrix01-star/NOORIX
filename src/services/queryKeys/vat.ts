/**
 * مفاتيح React Query — التخطيط الضريبي / الإقرارات
 */
export const vatKeys = {
  planning: (year: unknown, quarter: unknown, companyId: string) =>
    ['vat-planning', year, quarter, companyId] as const,

  registry: (year: string, quarter: string, companyId: string) =>
    ['vat-planning', 'registry', year, quarter, companyId] as const,

  registryMetadata: () => ['vat-planning', 'registry', 'metadata'] as const,

  root: () => ['vat-planning'] as const,
};
