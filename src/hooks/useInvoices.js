/**
 * useInvoices — جلب الفواتير مع فلترة التاريخ والتصفح.
 * placeholderData فقط داخل نفس الشركة (تصفح الصفحات/الفلاتر) — لا عرض فواتير شركة سابقة عند تبديل الشركة.
 */
import { useQuery } from '@tanstack/react-query';
import { getInvoices } from '../services/api';

/**
 * @param {{ companyId: string, startDate: string, endDate: string, page?: number, pageSize?: number, kind?: string, sortBy?: string, sortDir?: 'asc'|'desc', supplierId?: string, q?: string, categoryId?: string, expenseLineId?: string, includeCancelled?: boolean }} params
 */
export function useInvoices({ companyId, startDate, endDate, page = 1, pageSize = 50, kind, sortBy = 'transactionDate', sortDir = 'desc', supplierId, q, categoryId, expenseLineId, includeCancelled = true }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['invoices', companyId, startDate, endDate, page, pageSize, kind, sortBy, sortDir, supplierId, q, categoryId, expenseLineId, includeCancelled],
    queryFn: async () => {
      const res = await getInvoices(companyId, startDate, endDate, page, pageSize, null, null, kind, sortBy, sortDir, supplierId, q, categoryId, expenseLineId, includeCancelled);
      if (!res.success) throw new Error(res.error || 'فشل تحميل الفواتير');
      return res.data;
    },
    placeholderData: (previousData, previousQuery) => {
      const prevCompany = previousQuery?.queryKey?.[1];
      if (prevCompany !== companyId) return undefined;
      return previousData;
    },
    enabled: !!companyId,
  });

  const zero = () => ({ net: '0', tax: '0', total: '0', count: 0 });
  return {
    items:    data?.items ?? [],
    total:    data?.total ?? 0,
    sums:     data?.sums  ?? { all: zero(), inflow: zero(), outflow: zero() },
    sumsByKind: Array.isArray(data?.sumsByKind) ? data.sumsByKind : [],
    isLoading,
    isError,
    error,
  };
}
