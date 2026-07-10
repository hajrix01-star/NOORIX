import { toYmd } from '../../../utils/saudiDate';

export type InvoiceListSortDir = 'asc' | 'desc' | string;

export type InvoiceListApiQuerySource = {
  companyId: string;
  startDate?: string | null;
  endDate?: string | null;
  page?: number | string | null;
  pageSize?: number | string | null;
  batchId?: string | null;
  employeeId?: string | null;
  kind?: string | null;
  sortBy?: string | null;
  sortDir?: InvoiceListSortDir | null;
  supplierId?: string | null;
  supplierCategoryId?: string | null;
  q?: string | null;
  categoryId?: string | null;
  expenseLineId?: string | null;
  includeCancelled?: boolean | string | number | null;
  hasNotes?: boolean;
  vaultId?: string | null;
  createdByUserId?: string | null;
  requireExpenseLine?: string | boolean | null;
};

export type InvoiceListFetchParams = {
  companyId: string;
  startDate: string | undefined;
  endDate: string | undefined;
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

export function buildInvoiceListFetchParams(source: InvoiceListApiQuerySource): InvoiceListFetchParams {
  return {
    companyId: source.companyId,
    startDate: optionalYmd(source.startDate),
    endDate: optionalYmd(source.endDate),
    kind: optionalString(source.kind),
    sortBy: optionalString(source.sortBy) ?? 'transactionDate',
    sortDir: optionalString(source.sortDir) ?? 'desc',
    supplierId: optionalString(source.supplierId),
    supplierCategoryId: optionalString(source.supplierCategoryId),
    q: optionalString(source.q),
    categoryId: optionalString(source.categoryId),
    expenseLineId: optionalString(source.expenseLineId),
    includeCancelled: parseBoolean(source.includeCancelled),
    hasNotes: source.hasNotes === true ? true : undefined,
    vaultId: optionalString(source.vaultId),
    batchId: optionalString(source.batchId),
    createdByUserId: optionalString(source.createdByUserId),
  };
}

export function buildInvoiceListApiQuery(source: InvoiceListApiQuerySource): Record<string, string> {
  const normalized = buildInvoiceListFetchParams(source);
  const params: Record<string, string> = {
    companyId: normalized.companyId,
    page: String(clampInt(source.page, 1, 1, Number.MAX_SAFE_INTEGER)),
    pageSize: String(clampInt(source.pageSize, 50, 1, 200)),
    includeCancelled: normalized.includeCancelled ? 'true' : 'false',
  };

  addOptional(params, 'startDate', normalized.startDate);
  addOptional(params, 'endDate', normalized.endDate);
  addOptional(params, 'batchId', normalized.batchId);
  addOptional(params, 'employeeId', optionalString(source.employeeId));
  addOptional(params, 'kind', normalized.kind);
  addOptional(params, 'sortBy', normalized.sortBy);
  addOptional(params, 'sortDir', normalized.sortDir);
  addOptional(params, 'supplierId', normalized.supplierId);
  addOptional(params, 'supplierCategoryId', normalized.supplierCategoryId);
  addOptional(params, 'q', normalized.q);
  addOptional(params, 'categoryId', normalized.categoryId);
  addOptional(params, 'expenseLineId', normalized.expenseLineId);
  addOptional(params, 'vaultId', normalized.vaultId);
  addOptional(params, 'createdByUserId', normalized.createdByUserId);
  if (normalized.hasNotes === true) params.hasNotes = 'true';
  if (source.requireExpenseLine === true || source.requireExpenseLine === 'true' || source.requireExpenseLine === '1') {
    params.requireExpenseLine = 'true';
  }

  return params;
}

function optionalString(value: unknown): string | undefined {
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
}

function optionalYmd(value: unknown): string | undefined {
  const ymd = value != null && value !== '' ? toYmd(value) : '';
  return ymd || undefined;
}

function addOptional(params: Record<string, string>, key: string, value: string | undefined) {
  if (value) params[key] = value;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 1;
}
