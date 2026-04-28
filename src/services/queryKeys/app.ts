/**
 * مفاتيح React Query — جلسة التطبيق والشركات
 */
export const appKeys = {
  me: () => ['me'] as const,

  companies: (includeArchived: boolean) => ['companies', includeArchived] as const,

  companiesRoot: () => ['companies'] as const,
};
