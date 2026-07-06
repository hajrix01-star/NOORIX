import { getInvoices } from '../services/api';
import { invoiceKeys } from '../services/queryKeys';
import type { InvoiceListResponse } from '../services/domains/apiEndpoints/invoice-list-response';
import {
  zeroInvoiceListOutflowSummary,
  zeroInvoiceListSums,
} from '../services/domains/apiEndpoints/invoice-list-response';
import { useApiQuery } from './useApiQuery';

export type UseInvoicesParams = {
  companyId: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  kind?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc' | string;
  supplierId?: string;
  supplierCategoryId?: string;
  q?: string;
  categoryId?: string;
  expenseLineId?: string;
  includeCancelled?: boolean;
  hasNotes?: boolean;
  vaultId?: string;
  batchId?: string;
  createdByUserId?: string;
  requireExpenseLine?: string | boolean;
};

export function useInvoices({
  companyId,
  startDate,
  endDate,
  page = 1,
  pageSize = 50,
  kind,
  sortBy = 'transactionDate',
  sortDir = 'desc',
  supplierId,
  supplierCategoryId,
  q,
  categoryId,
  expenseLineId,
  includeCancelled = true,
  hasNotes,
  vaultId,
  batchId,
  createdByUserId,
  requireExpenseLine,
}: UseInvoicesParams) {
  const { data, isLoading, isFetching, isPlaceholderData, isError, error } = useApiQuery<InvoiceListResponse>({
    queryKey: invoiceKeys.list({
      companyId,
      startDate,
      endDate,
      page,
      pageSize,
      kind,
      sortBy,
      sortDir,
      supplierId,
      supplierCategoryId,
      q,
      categoryId,
      expenseLineId,
      includeCancelled,
      hasNotes,
      vaultId,
      batchId,
      createdByUserId,
      requireExpenseLine,
    }),
    queryFn: () => getInvoices(companyId, startDate, endDate, page, pageSize, batchId || null, null, kind, sortBy, sortDir, supplierId, supplierCategoryId, q, categoryId, expenseLineId, includeCancelled, hasNotes, vaultId, createdByUserId || undefined, requireExpenseLine),
    fallbackMessage: 'Failed to load invoices',
    placeholderData: (previousData, previousQuery) => {
      const prevCompany = previousQuery?.queryKey?.[1];
      if (prevCompany !== companyId) return undefined;
      return previousData;
    },
    enabled: !!companyId,
  });

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    sums: data?.sums ?? zeroInvoiceListSums(),
    sumsByKind: data?.sumsByKind ?? [],
    inflowByVault: data?.inflowByVault ?? [],
    outflowSummary: data?.outflowSummary ?? zeroInvoiceListOutflowSummary(),
    isLoading,
    isFetching,
    isPlaceholderData,
    isError,
    error,
  };
}
