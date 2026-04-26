import { useQuery } from '@tanstack/react-query';
import { getSalesChannels, throwIfApiFailed } from '../services/api';

export function useSalesChannels(companyId: any) {
  const query = useQuery({
    queryKey: ['sales-channels', companyId],
    queryFn: async () => {
      const res = await getSalesChannels(companyId);
      throwIfApiFailed(res, 'فشل تحميل قنوات البيع');
      const data = res.data;
      return Array.isArray(data) ? data : (data?.items ?? []);
    },
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
