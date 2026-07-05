export type InvoiceListSortDir = 'asc' | 'desc' | string;

export type InvoiceListQuerySource = {
  companyId: string;
  startDate: string;
  endDate: string;
  kind?: string;
  sortBy: string;
  sortDir: InvoiceListSortDir;
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
};

export type InvoiceListFetchParams = {
  companyId: string;
  startDate: string;
  endDate: string;
  kind: string | undefined;
  sortBy: string;
  sortDir: InvoiceListSortDir;
  supplierId: string | undefined;
  supplierCategoryId: string | undefined;
  q: string | undefined;
  categoryId: string | undefined;
  expenseLineId: string | undefined;
  includeCancelled: boolean;
  hasNotes: boolean | undefined;
  vaultId: string | undefined;
  batchId: string | undefined;
  createdByUserId: string | undefined;
};

function optionalString(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
}

export function buildInvoiceListFetchParams(source: InvoiceListQuerySource): InvoiceListFetchParams {
  return {
    companyId: source.companyId,
    startDate: source.startDate,
    endDate: source.endDate,
    kind: optionalString(source.kind),
    sortBy: source.sortBy,
    sortDir: source.sortDir,
    supplierId: optionalString(source.supplierId),
    supplierCategoryId: optionalString(source.supplierCategoryId),
    q: optionalString(source.q),
    categoryId: optionalString(source.categoryId),
    expenseLineId: optionalString(source.expenseLineId),
    includeCancelled: source.includeCancelled,
    hasNotes: source.hasNotes || undefined,
    vaultId: optionalString(source.vaultId),
    batchId: optionalString(source.batchId),
    createdByUserId: optionalString(source.createdByUserId),
  };
}
