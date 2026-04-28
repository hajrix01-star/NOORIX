/**
 * مفاتيح React Query — بنود المصروفات
 */
export const expenseKeys = {
  lines: (companyId: string) => ['expense-lines', companyId] as const,
};
