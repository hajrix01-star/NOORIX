/**
 * useSales — ملخصات المبيعات اليومية
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDailySalesSummaries,
  createDailySalesSummary,
  updateDailySalesSummary,
  cancelDailySalesSummary,
} from '../services/api';
import { invalidateOnFinancialMutation } from '../utils/queryInvalidation';

/**
 * @param {{ companyId: string, startDate?: string, endDate?: string, enabled?: boolean, fetchList?: boolean }} params
 * fetchList=false: لا يجلب القائمة (لشاشة المبيعات مع ترقيم منفصل) — يبقى الطفرات فقط.
 */
export function useSales({ companyId, startDate, endDate, enabled = true, fetchList = true }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['sales-summaries', companyId, startDate, endDate],
    queryFn: async () => {
      const pageSize = 150;
      let page = 1;
      const acc = [];
      let reportedTotal = 0;
      for (let guard = 0; guard < 500; guard++) {
        const res = await getDailySalesSummaries(companyId, startDate, endDate, page, pageSize);
        if (!res?.success) return [];
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

  const createMutation = useMutation({
    mutationFn: createDailySalesSummary,
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body, companyId: cid }) => updateDailySalesSummary(id, body, cid),
    onSuccess: invalidate,
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, companyId: cid }) => cancelDailySalesSummary(id, cid),
    onSuccess: invalidate,
  });

  return {
    summaries,
    isLoading,
    createSummary: createMutation,
    updateSummary: updateMutation,
    cancelSummary: cancelMutation,
  };
}
