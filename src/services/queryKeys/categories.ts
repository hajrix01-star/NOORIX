/**
 * مفاتيح React Query — التصنيفات المحاسبية
 */
export const categoryKeys = {
  list: (companyId: string) => ['categories', companyId] as const,

  root: () => ['categories'] as const,
};
