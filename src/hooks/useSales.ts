import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from './useApiMutation';
import { useApiListQuery } from './useApiQuery';
import {
  getDailySalesSummaries,
  createDailySalesSummary,
  createDailySalesSummaryBatch,
  updateDailySalesSummary,
  deleteDailySalesSummary,
  throwIfApiFailed,
} from '../services/api';
import { invalidateOnFinancialMutation } from '../utils/queryInvalidation';
import { salesKeys } from '../services/queryKeys';
import type {
  CreateSalesSummaryBody,
  DailySalesBatchPayload,
  SalesSummariesPage,
  SalesSummaryItem,
  UpdateSalesSummaryBody,
} from '../types/api/domains/sales';

export type UseSalesOptions = {
  companyId: string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
  fetchList?: boolean;
};

type UpdateSalesSummaryMutationInput = {
  id: string;
  body: UpdateSalesSummaryBody;
  companyId: string;
};

type DeleteSalesSummaryMutationInput = {
  id: string;
  companyId: string;
};

async function getAllDailySalesSummaries(companyId: string, startDate?: string, endDate?: string) {
  const pageSize = 150;
  let page = 1;
  const acc: SalesSummaryItem[] = [];
  let reportedTotal = 0;

  for (let guard = 0; guard < 25; guard += 1) {
    const res = await getDailySalesSummaries(companyId, startDate, endDate, page, pageSize);
    throwIfApiFailed(res, 'Failed to load daily sales summaries');
    const data = res.data;
    const { items = [], total = 0 } = data || {};
    reportedTotal = Number(total) || 0;
    acc.push(...items);
    if (acc.length >= reportedTotal || items.length < pageSize) break;
    page += 1;
  }

  return { success: true, data: acc };
}

export function useSales({ companyId, startDate, endDate, enabled = true, fetchList = true }: UseSalesOptions) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useApiListQuery<SalesSummaryItem>({
    queryKey: salesKeys.summaries(companyId, startDate, endDate),
    queryFn: () => getAllDailySalesSummaries(companyId, startDate, endDate),
    fallbackMessage: 'Failed to load daily sales summaries',
    enabled: !!companyId && enabled && fetchList,
  });

  const summaries = data ?? [];

  const invalidate = () => {
    invalidateOnFinancialMutation(queryClient);
  };

  const createMutation = useApiMutation({
    mutationFn: (body: CreateSalesSummaryBody) => createDailySalesSummary(body),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  const createBatchMutation = useApiMutation({
    mutationFn: (body: DailySalesBatchPayload) => createDailySalesSummaryBatch(body),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body, companyId: cid }: UpdateSalesSummaryMutationInput) => updateDailySalesSummary(id, body, cid),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  const deleteMutation = useApiMutation({
    mutationFn: ({ id, companyId: cid }: DeleteSalesSummaryMutationInput) => deleteDailySalesSummary(id, cid),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  return {
    summaries,
    isLoading,
    isError,
    error,
    createSummary: createMutation,
    createSummaryBatch: createBatchMutation,
    updateSummary: updateMutation,
    deleteSummary: deleteMutation,
  };
}
