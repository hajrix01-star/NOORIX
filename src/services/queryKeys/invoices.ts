/**
 * مفاتيح React Query — قائمة الفواتير (جدول الفواتير)
 */
export type InvoiceListKeyParams = {
  companyId: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
  kind?: string;
  sortBy: string;
  sortDir: string;
  supplierId?: string;
  supplierCategoryId?: string;
  q?: string;
  categoryId?: string;
  expenseLineId?: string;
  includeCancelled: boolean;
  hasNotes?: boolean;
  vaultId?: string;
  batchId?: string;
  createdByUserId?: string;
  requireExpenseLine?: string | boolean;
};

export const invoiceKeys = {
  list: (p: InvoiceListKeyParams) =>
    [
      'invoices',
      p.companyId,
      p.startDate,
      p.endDate,
      p.page,
      p.pageSize,
      p.kind,
      p.sortBy,
      p.sortDir,
      p.supplierId,
      p.supplierCategoryId,
      p.q,
      p.categoryId,
      p.expenseLineId,
      p.includeCancelled,
      p.hasNotes,
      p.vaultId,
      p.batchId,
      p.createdByUserId,
      p.requireExpenseLine,
    ] as const,

  /** سجل المدفوعات (تبويب مصروفات) — شكل مبسّط */
  paymentHistoryExpense: (
    companyId: string,
    startDate: unknown,
    endDate: unknown,
    kindParam: string,
  ) => ['invoices', companyId, startDate, endDate, kindParam, 'requireExpenseLine'] as const,

  advancesForCompany: (companyId: string) => ['invoices', companyId, 'advance'] as const,

  advancesForEmployee: (companyId: string, employeeId: unknown) =>
    ['invoices', companyId, 'advance', employeeId] as const,

  advancesForMonth: (companyId: string, monthStr: string) =>
    ['invoices', companyId, 'advance', monthStr] as const,

  hrAllForEmployee: (companyId: string, employeeId: unknown) =>
    ['invoices', companyId, 'hr-all', employeeId] as const,

  dayClose: (companyId: string, dateStr: unknown) =>
    ['invoice-day-close', companyId, dateStr] as const,

  creatorFilterOptions: (companyId: string) =>
    ['invoice-creator-filter-options', companyId] as const,

  creatorFilterOptionsRoot: () => ['invoice-creator-filter-options'] as const,

  dayCloseRoot: () => ['invoice-day-close'] as const,

  /** بادئة إبطال كل استعلامات الفواتير */
  root: () => ['invoices'] as const,
};
