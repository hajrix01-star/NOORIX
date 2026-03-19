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
 * @param {{ companyId: string, startDate?: string, endDate?: string, enabled?: boolean }} params
 */
export function useSales({ companyId, startDate, endDate, enabled = true }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['sales-summaries', companyId, startDate, endDate],
    queryFn: async () => {
      const res = await getDailySalesSummaries(companyId, startDate, endDate);
      if (!res?.success) return [];
      const d = res.data;
      const items = d?.items ?? d?.data ?? (Array.isArray(d) ? d : []);
      return items;
    },
    enabled: !!companyId && enabled,
  });

  const summaries = data ?? [];

  const invalidate = () => invalidateOnFinancialMutation(queryClient);

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
