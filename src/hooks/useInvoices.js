/**
 * useInvoices — جلب الفواتير مع فلترة التاريخ والتصفح.
 * يدعم placeholderData لمنع وميض البيانات عند التنقل بين الصفحات.
 */
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { getInvoices, createInvoice } from '../services/api';
import { invalidateOnFinancialMutation } from '../utils/queryInvalidation';

/**
 * @param {{ companyId: string, startDate: string, endDate: string, page?: number, pageSize?: number, kind?: string, sortBy?: string, sortDir?: 'asc'|'desc', supplierId?: string, q?: string, categoryId?: string, expenseLineId?: string }} params
 */
export function useInvoices({ companyId, startDate, endDate, page = 1, pageSize = 50, kind, sortBy = 'transactionDate', sortDir = 'desc', supplierId, q, categoryId, expenseLineId }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['invoices', companyId, startDate, endDate, page, pageSize, kind, sortBy, sortDir, supplierId, q, categoryId, expenseLineId],
    queryFn: async () => {
      const res = await getInvoices(companyId, startDate, endDate, page, pageSize, null, null, kind, sortBy, sortDir, supplierId, q, categoryId, expenseLineId);
      if (!res.success) throw new Error(res.error || 'فشل تحميل الفواتير');
      return res.data;
    },
    placeholderData: (prev) => prev, // لا وميض عند تغيير الصفحة
    enabled: !!companyId,
  });

  const zero = () => ({ net: '0', tax: '0', total: '0', count: 0 });
  return {
    items:    data?.items ?? [],
    total:    data?.total ?? 0,
    sums:     data?.sums  ?? { all: zero(), inflow: zero(), outflow: zero() },
    isLoading,
    isError,
    error,
  };
}

/**
 * useSaveInvoice — mutation لحفظ فاتورة مفردة أو دفعة.
 */
export function useSaveInvoice(companyId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInvoice,
    onSuccess: () => invalidateOnFinancialMutation(queryClient),
  });
}
