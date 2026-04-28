/**
 * مفاتيح React Query — كشوف بنك / تحليل بنكي
 * البادئات تتوافق مع queryInvalidation والاستخدام الحالي.
 */
export const bankKeys = {
  statement: (companyId: string, statementId: string | number) =>
    ['bank-statement', companyId, String(statementId)] as const,

  /** بادئة تفاصيل أي كشف */
  statementDetailRoot: () => ['bank-statement'] as const,

  statementsList: () => ['bank-statements'] as const,

  statementsListFiltered: (companyId: string, filterMonth: string, filterBank: string) =>
    ['bank-statements', companyId, filterMonth, filterBank] as const,

  statementsSummary: () => ['bank-statements-summary'] as const,

  statementsSummaryByCompany: (companyId: string) =>
    ['bank-statements-summary', companyId] as const,

  statementCategories: (companyId: string) => ['bank-statement-categories', companyId] as const,

  statementCategoriesRoot: () => ['bank-statement-categories'] as const,

  reconciliationStats: (companyId: string, reconStart: string, reconEnd: string) =>
    ['bank-reconciliation-stats', companyId, reconStart, reconEnd] as const,

  /** إبطال جزئي لكل إحصاءات المطابقة لشركة */
  reconciliationStatsByCompany: (companyId: string) =>
    ['bank-reconciliation-stats', companyId] as const,

  statementMapping: (companyId: string, statementId: string | number | null | undefined) =>
    ['bank-statement-mapping', companyId, statementId] as const,

  statementTemplates: (companyId: string) => ['bank-statement-templates', companyId] as const,

  treeCategories: (companyId: string) => ['bank-tree-categories', companyId] as const,

  classificationRules: (companyId: string) => ['bank-classification-rules', companyId] as const,
};
