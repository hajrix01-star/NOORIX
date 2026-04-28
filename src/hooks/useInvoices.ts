/**
 * useInvoices — جلب الفواتير مع فلترة التاريخ والتصفح.
 * placeholderData فقط داخل نفس الشركة (تصفح الصفحات/الفلاتر) — لا عرض فواتير شركة سابقة عند تبديل الشركة.
 */
import { useQuery } from '@tanstack/react-query';
import { getInvoices, throwIfApiFailed } from '../services/api';
import { invoiceKeys } from '../services/queryKeys';

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

/** جلب الفواتير مع فلترة التاريخ والتصفح */
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
  const { data, isLoading, isError, error } = useQuery({
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
    queryFn: async () => {
      const res = await getInvoices(companyId, startDate, endDate, page, pageSize, batchId || null, null, kind, sortBy, sortDir, supplierId, q, categoryId, expenseLineId, includeCancelled, hasNotes, vaultId, createdByUserId || undefined, requireExpenseLine);
      throwIfApiFailed(res, 'فشل تحميل الفواتير');
      return res.data;
    },
    placeholderData: (previousData: any, previousQuery: any) => {
      const prevCompany = previousQuery?.queryKey?.[1];
      if (prevCompany !== companyId) return undefined;
      return previousData;
    },
    enabled: !!companyId,
  });

  const zero = () => ({ net: '0', tax: '0', total: '0', count: 0 });
  const zeroOutflowSummary = () => ({ purchasesTotal: '0', expensesTotal: '0', taxTotal: '0' });
  return {
    items:    data?.items ?? [],
    total:    data?.total ?? 0,
    sums:     data?.sums  ?? { all: zero(), inflow: zero(), outflow: zero() },
    sumsByKind: Array.isArray(data?.sumsByKind) ? data.sumsByKind : [],
    inflowByVault: Array.isArray(data?.inflowByVault) ? data.inflowByVault : [],
    outflowSummary: data?.outflowSummary ?? zeroOutflowSummary(),
    isLoading,
    isError,
    error,
  };
}
