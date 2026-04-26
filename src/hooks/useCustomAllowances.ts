import { useQuery } from '@tanstack/react-query';
import { getCustomAllowances, throwIfApiFailed } from '../services/api';

export function useCustomAllowances(companyId: string, employeeId?: string | null) {
  const query = useQuery({
    queryKey: ['custom-allowances', companyId, employeeId || 'all'],
    queryFn: async () => {
      const res = await getCustomAllowances(companyId, employeeId ?? undefined);
      throwIfApiFailed(res, 'فشل تحميل البدلات المخصصة');
      const data = res.data;
      return Array.isArray(data) ? data : (data?.items ?? []);
    },
    enabled: !!companyId,
  });

  return {
    allowances: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
