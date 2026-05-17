/**
 * مفاتيح React Query — الموارد البشرية (إجازات، إقامات، مسيرات، مستندات، …)
 */
export const hrKeys = {
  leaves: (companyId: string) => ['leaves', companyId] as const,

  leavesForYear: (companyId: string, year: unknown) => ['leaves', companyId, year] as const,

  leavesByEmployee: (companyId: string, employeeId: unknown) => ['leaves', companyId, employeeId] as const,

  leavesPayrollForm: (companyId: string) => ['leaves', companyId, 'payroll-form'] as const,

  leaveSalarySettlements: (companyId: string) => ['leave-salary-settlements', companyId] as const,

  leaveSalarySettlementsForMonth: (companyId: string, payrollMonth: unknown) =>
    ['leave-salary-settlements', companyId, payrollMonth] as const,

  leaveSettlementPreview: (companyId: string, settlementId: unknown) =>
    ['leave-salary-settlement-preview', companyId, settlementId] as const,

  residencies: (companyId: string) => ['residencies', companyId] as const,

  residenciesByEmployee: (companyId: string, employeeId: unknown) =>
    ['residencies', companyId, employeeId] as const,

  documents: (companyId: string, employeeId: unknown) => ['documents', companyId, employeeId] as const,

  deductions: (companyId: string, employeeId: unknown) => ['deductions', companyId, employeeId] as const,

  deductionsByCompany: (companyId: string) => ['deductions', companyId] as const,

  movementsCompany: (companyId: string) => ['movements', companyId] as const,

  movementsByEmployee: (companyId: string, employeeId: unknown) =>
    ['movements', companyId, employeeId] as const,

  payrollRuns: (companyId: string, year: unknown) => ['payroll-runs', companyId, year] as const,

  payrollRun: (runId: unknown, companyId: string) => ['payroll-run', runId, companyId] as const,

  payrollRunItems: (companyId: string, employeeId: unknown) =>
    ['payroll-run-items', companyId, employeeId] as const,

  terminationAdvances: (companyId: string, empId: unknown) =>
    ['termination-settlement-advances', companyId, empId] as const,

  terminationSalaryExists: (
    companyId: string,
    empId: unknown,
    monthFirst: unknown,
    termSalaryTag: unknown,
  ) => ['termination-settlement-salary-exists', companyId, empId, monthFirst, termSalaryTag] as const,

  /** بادئة إبطال فحوصات وجود راتب إنهاء لموظف */
  terminationSalaryExistsByEmployee: (companyId: string, empId: unknown) =>
    ['termination-settlement-salary-exists', companyId, empId] as const,

  employeesPaged: (
    companyId: string,
    viewMode: string,
    listPage: number,
    pageSize: number,
    debouncedQ: string,
    sortKey: string,
    sortDir: string,
  ) =>
    ['employees-paged', companyId, viewMode, listPage, pageSize, debouncedQ, sortKey, sortDir] as const,

  customAllowances: (companyId: string, employeeId: string | 'all') =>
    ['custom-allowances', companyId, employeeId] as const,

  /** بادئة إبطال بدلات مخصصة لشركة */
  customAllowancesByCompany: (companyId: string) => ['custom-allowances', companyId] as const,

  payrollRunsRoot: () => ['payroll-runs'] as const,

  payrollRunRoot: () => ['payroll-run'] as const,

  payrollRunItemsRoot: () => ['payroll-run-items'] as const,

  deductionsRoot: () => ['deductions'] as const,

  movementsRoot: () => ['movements'] as const,

  leavesRoot: () => ['leaves'] as const,

  residenciesRoot: () => ['residencies'] as const,

  documentsRoot: () => ['documents'] as const,

  leaveSalarySettlementsRoot: () => ['leave-salary-settlements'] as const,

  leaveSalarySettlementPreviewRoot: () => ['leave-salary-settlement-preview'] as const,

  terminationSettlementAdvancesRoot: () => ['termination-settlement-advances'] as const,

  terminationSettlementSalaryExistsRoot: () => ['termination-settlement-salary-exists'] as const,

  customAllowancesRoot: () => ['custom-allowances'] as const,

  /** ملخص لوحة HR الموحّد — إجازات + إقامات + سلف */
  dashboardSummary: (companyId: string) => ['hr-dashboard-summary', companyId] as const,

  dashboardSummaryRoot: () => ['hr-dashboard-summary'] as const,
};
