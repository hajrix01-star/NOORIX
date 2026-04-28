/**
 * مفاتيح React Query — كشوف بنك / تحليل بنكي
 * البادئات تتوافق مع queryInvalidation والاستخدام الحالي.
 */
export const bankKeys = {
  statement: (companyId: string, statementId: string | number) =>
    ['bank-statement', companyId, String(statementId)] as const,

  statementsList: () => ['bank-statements'] as const,

  statementsSummary: () => ['bank-statements-summary'] as const,

  reconciliationStats: (companyId: string, reconStart: string, reconEnd: string) =>
    ['bank-reconciliation-stats', companyId, reconStart, reconEnd] as const,

  /** إبطال جزئي لكل إحصاءات المطابقة لشركة */
  reconciliationStatsByCompany: (companyId: string) =>
    ['bank-reconciliation-stats', companyId] as const,
};
