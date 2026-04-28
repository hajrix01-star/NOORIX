/**
 * مفاتيح React Query — بنود المصروفات
 */
export const expenseKeys = {
  lines: (companyId: string) => ['expense-lines', companyId] as const,

  /** بادئة إبطال كل استعلامات بنود مصروفات */
  linesRoot: () => ['expense-lines'] as const,

  linesWithKind: (companyId: string, filterKind: string) =>
    ['expense-lines', companyId, filterKind] as const,

  line: (lineId: unknown, companyId: string) => ['expense-line', lineId, companyId] as const,

  linePayments: (
    lineId: unknown,
    companyId: string,
    startDate: unknown,
    endDate: unknown,
    page: number,
  ) => ['expense-line-payments', lineId, companyId, startDate, endDate, page] as const,
};
