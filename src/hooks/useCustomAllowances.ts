import { getCustomAllowances } from '../services/api';
import { hrKeys } from '../services/queryKeys';
import { useApiListQuery } from './useApiQuery';

export function useCustomAllowances(companyId: string, employeeId?: string | null) {
  const query = useApiListQuery<any>({
    queryKey: hrKeys.customAllowances(companyId, (employeeId || 'all') as 'all' | string),
    queryFn: () => getCustomAllowances(companyId, employeeId ?? undefined),
    fallbackMessage: 'Failed to load custom allowances',
    enabled: !!companyId,
  });

  return {
    allowances: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
