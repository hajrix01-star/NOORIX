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
};
