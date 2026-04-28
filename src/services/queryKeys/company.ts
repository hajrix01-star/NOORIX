/**
 * مفاتيح React Query — شركة واحدة (إعدادات/بيانات)
 */
export const companyKeys = {
  single: (companyId: string) => ['company', companyId] as const,

  root: () => ['company'] as const,
};
