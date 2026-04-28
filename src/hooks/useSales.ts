/**
 * useSales — ملخصات المبيعات اليومية
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from './useApiMutation';
import {
  getDailySalesSummaries,
  createDailySalesSummary,
  updateDailySalesSummary,
  deleteDailySalesSummary,
  throwIfApiFailed,
} from '../services/api';
import { invalidateOnFinancialMutation } from '../utils/queryInvalidation';
import { salesKeys } from '../services/queryKeys';

/**
 * @param {{ companyId: string, startDate?: string, endDate?: string, enabled?: boolean, fetchList?: boolean }} params
 * fetchList=false: لا يجلب القائمة (لشاشة المبيعات مع ترقيم منفصل) — يبقى الطفرات فقط.
 */
export function useSales({ companyId, startDate, endDate, enabled = true, fetchList = true }: any) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: salesKeys.summaries(companyId, startDate, endDate),
    queryFn: async () => {
      const pageSize = 150;
      let page = 1;
      const acc = [];
      let reportedTotal = 0;
      /** سقف صفحات — يمنع آلاف الطلبات عند بيانات ضخمة؛ التصدير يستخدم دالة منفصلة. */
      for (let guard = 0; guard < 25; guard++) {
        const res = await getDailySalesSummaries(companyId, startDate, endDate, page, pageSize);
        throwIfApiFailed(res, 'فشل تحميل ملخصات المبيعات');
        const { items = [], total = 0 } = res.data || {};
        reportedTotal = Number(total) || 0;
        acc.push(...items);
        if (acc.length >= reportedTotal || items.length < pageSize) break;
        page += 1;
      }
      return acc;
    },
    enabled: !!companyId && enabled && fetchList,
  });

  const summaries = data ?? [];

  const invalidate = () => {
    invalidateOnFinancialMutation(queryClient);
  };

  const createMutation = useApiMutation({
    mutationFn: createDailySalesSummary,
    onSuccess: invalidate,
    showErrorToast: false,
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body, companyId: cid }: any) => updateDailySalesSummary(id, body, cid),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  const deleteMutation = useApiMutation({
    mutationFn: ({ id, companyId: cid }: any) => deleteDailySalesSummary(id, cid),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  return {
    summaries,
    isLoading,
    isError,
    error,
    createSummary: createMutation,
    updateSummary: updateMutation,
    deleteSummary: deleteMutation,
  };
}
