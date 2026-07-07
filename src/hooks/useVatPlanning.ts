import { getVatPlanningList, getVatPlanningRegistry, getVatPlanningRegistryMetadata, upsertVatPlanning } from '../services/api';
import { vatKeys } from '../services/queryKeys';
import type {
  VatPlanningRecord,
  VatPlanningRegistryMetadata,
  VatPlanningRegistryFilters,
  VatPlanningUpsertPayload,
} from '../types/api/domains/hajriTax';
import { useApiListQuery, useApiQuery } from './useApiQuery';
import { useApiMutation } from './useApiMutation';

export function useVatPlanningList(
  year: number,
  quarter: number,
  companyId?: string,
  enabled = true,
) {
  return useApiListQuery<VatPlanningRecord>({
    queryKey: vatKeys.planning(year, quarter, companyId ?? ''),
    queryFn: () => getVatPlanningList(year, quarter, companyId),
    fallbackMessage: 'Failed to load VAT planning record',
    enabled: !!enabled && Number.isFinite(year) && Number.isFinite(quarter),
  });
}

export function useVatPlanningRegistry(filters: VatPlanningRegistryFilters, enabled = true) {
  return useApiListQuery<VatPlanningRecord>({
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

export function useVatPlanningRegistryMetadata(enabled = true) {
  return useApiQuery<VatPlanningRegistryMetadata>({
    queryKey: vatKeys.registryMetadata(),
    queryFn: () => getVatPlanningRegistryMetadata(),
    fallbackMessage: 'Failed to load VAT planning filter metadata',
    enabled: !!enabled,
  });
}

export function useUpsertVatPlanning() {
  return useApiMutation({
    mutationFn: (body: VatPlanningUpsertPayload) => upsertVatPlanning(body),
    invalidateQueries: [{ queryKey: vatKeys.root() }],
    errorToast: 'Failed to save VAT planning record',
  });
}
