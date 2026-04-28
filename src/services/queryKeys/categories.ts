/**
 * مفاتيح React Query — التصنيفات المحاسبية
 */
export const categoryKeys = {
  list: (companyId: string) => ['categories', companyId] as const,
};
