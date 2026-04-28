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
};
