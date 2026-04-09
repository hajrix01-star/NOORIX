import { useQuery } from '@tanstack/react-query';
import { getCustomAllowances } from '../services/api';

export function useCustomAllowances(companyId, employeeId) {
  const query = useQuery({
    queryKey: ['custom-allowances', companyId, employeeId || 'all'],
    queryFn: async () => {
      const res = await getCustomAllowances(companyId, employeeId);
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل البدلات المخصصة');
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
