/**
 * مفاتيح React Query — الموظفون
 */
export const employeeKeys = {
  list: (companyId: string, includeTerminated: boolean) =>
    ['employees', companyId, includeTerminated] as const,

  detail: (employeeId: unknown, companyId: string) =>
    ['employee', employeeId, companyId] as const,

  pagedByCompany: (companyId: string) => ['employees-paged', companyId] as const,

  /** بادئة إبطال كل قوائم موظفي شركة (كل قيم includeTerminated) */
  byCompany: (companyId: string) => ['employees', companyId] as const,

  /** إبطال كل الشركات/القوائم */
  root: () => ['employees'] as const,

  employeesPagedRoot: () => ['employees-paged'] as const,

  employeeRoot: () => ['employee'] as const,

  /** بادئة تفصيل موظف بدون companyId (إبطال جزئي) */
  detailPartial: (employeeId: unknown) => ['employee', employeeId] as const,
};
