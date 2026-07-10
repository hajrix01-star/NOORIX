import { getSalesChannels } from '../services/api';
import { salesKeys } from '../services/queryKeys';
import { useApiListQuery } from './useApiQuery';
import type { SalesInputVaultRef } from '../types/api/domains/sales';

export function useSalesChannels(companyId: string) {
  const query = useApiListQuery<SalesInputVaultRef>({
    queryKey: salesKeys.channels(companyId),
    queryFn: () => getSalesChannels(companyId),
    fallbackMessage: 'Failed to load sales channels',
    enabled: !!companyId,
    staleTime: 15 * 1000,
  });

  return {
    salesChannels: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
