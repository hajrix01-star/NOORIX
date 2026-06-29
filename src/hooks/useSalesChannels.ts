import { getSalesChannels } from '../services/api';
import { salesKeys } from '../services/queryKeys';
import { useApiListQuery } from './useApiQuery';

export function useSalesChannels(companyId: any) {
  const query = useApiListQuery<any>({
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
