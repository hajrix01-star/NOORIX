import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getVatPlanningList, getVatPlanningRegistry, upsertVatPlanning, throwIfApiFailed } from '../services/api';
import { vatKeys } from '../services/queryKeys';
import { useApiListQuery } from './useApiQuery';

export function useVatPlanningList(year: any, quarter: any, companyId: any, enabled: any = true) {
  return useApiListQuery<any>({
    queryKey: vatKeys.planning(year, quarter, companyId ?? ''),
    queryFn: () => getVatPlanningList(year, quarter, companyId),
    fallbackMessage: 'Failed to load VAT planning record',
    enabled: !!enabled && Number.isFinite(year) && Number.isFinite(quarter),
  });
}

export function useVatPlanningRegistry(filters: any, enabled: any = true) {
  return useApiListQuery<any>({
    queryKey: vatKeys.registry(
      String(filters?.year ?? ''),
      String(filters?.quarter ?? ''),
      String(filters?.companyId ?? ''),
    ),
    queryFn: () => getVatPlanningRegistry(filters),
    fallbackMessage: 'Failed to load VAT planning registry',
    enabled: !!enabled,
  });
}

export function useUpsertVatPlanning() {
  const qc = useQueryClient();
  return useMutation<any, Error, Record<string, unknown>>({
    mutationFn: async (body: any) => {
      const res = await upsertVatPlanning(body);
      throwIfApiFailed(res, 'Failed to save VAT planning record');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vatKeys.root() });
    },
  });
}
