import { getVatPlanningList, getVatPlanningRegistry, upsertVatPlanning } from '../services/api';
import { vatKeys } from '../services/queryKeys';
import { useApiListQuery } from './useApiQuery';
import { useApiMutation } from './useApiMutation';

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
  return useApiMutation({
    mutationFn: (body: Record<string, unknown>) => upsertVatPlanning(body),
    invalidateQueries: [{ queryKey: vatKeys.root() }],
    errorToast: 'Failed to save VAT planning record',
  });
}
