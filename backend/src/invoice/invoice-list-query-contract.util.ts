import { toYmd } from '../common/utils/to-ymd.util';
import type { InvoiceListQueryDto } from './dto/invoice-list-query.dto';

export type InvoiceListSortDir = 'asc' | 'desc' | string;

export type InvoiceListQueryContract = {
  companyId: string;
  page: number;
  pageSize: number;
  startDate?: string;
  endDate?: string;
  batchId?: string;
  employeeId?: string;
  kind?: string;
  supplierId?: string;
  supplierCategoryId?: string;
  categoryId?: string;
  expenseLineId?: string;
  vaultId?: string;
  createdByUserId?: string;
  sortBy: string;
  sortDir: InvoiceListSortDir;
  q?: string;
  includeCancelled: boolean;
  hasNotes?: boolean;
  requireExpenseLine?: boolean;
};

export function normalizeInvoiceListQuery(
  companyId: string,
  query: InvoiceListQueryDto,
  resolvedKind?: string,
): InvoiceListQueryContract {
  return {
    companyId,
    page: clampInt(query.page, 1, 1, Number.MAX_SAFE_INTEGER),
    pageSize: clampInt(query.pageSize, 50, 1, 200),
    startDate: optionalYmd(query.startDate),
    endDate: optionalYmd(query.endDate),
    batchId: optionalString(query.batchId),
    employeeId: optionalString(query.employeeId),
    kind: optionalString(resolvedKind),
    supplierId: optionalString(query.supplierId),
    supplierCategoryId: optionalString(query.supplierCategoryId),
    categoryId: optionalString(query.categoryId),
    expenseLineId: optionalString(query.expenseLineId),
    vaultId: optionalString(query.vaultId),
    createdByUserId: optionalString(query.createdByUserId),
    sortBy: optionalString(query.sortBy) ?? 'transactionDate',
    sortDir: optionalString(query.sortDir) ?? 'desc',
    q: optionalString(query.q),
    includeCancelled: query.includeCancelled === true,
    hasNotes: query.hasNotes === true ? true : undefined,
    requireExpenseLine: query.requireExpenseLine === true ? true : undefined,
  };
}

function optionalString(value: unknown): string | undefined {
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
}

function optionalYmd(value: unknown): string | undefined {
  const ymd = value != null && value !== '' ? toYmd(value) : '';
  return ymd || undefined;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
