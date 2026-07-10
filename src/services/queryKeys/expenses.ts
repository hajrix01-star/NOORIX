/**
 * مفاتيح React Query — بنود المصروفات
 */
export const expenseKeys = {
  lines: (companyId: string) => ['expense-lines', companyId] as const,

  /** بادئة إبطال كل استعلامات بنود مصروفات */
  linesRoot: () => ['expense-lines'] as const,

  lineRoot: () => ['expense-line'] as const,

  linePaymentsRoot: () => ['expense-line-payments'] as const,

  linesWithKind: (companyId: string, filterKind: string) =>
    ['expense-lines', companyId, filterKind] as const,

  line: (lineId: string, companyId: string) => ['expense-line', lineId, companyId] as const,

  linePayments: (
    lineId: string,
    companyId: string,
    startDate: string | undefined,
    endDate: string | undefined,
    page: number,
  ) => ['expense-line-payments', lineId, companyId, startDate, endDate, page] as const,
};
