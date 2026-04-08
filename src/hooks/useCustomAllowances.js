import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from './useApiMutation';
import {
  getCustomAllowances,
  createCustomAllowance,
  deleteCustomAllowance,
} from '../services/api';

export function useCustomAllowances(companyId, employeeId) {
  const queryClient = useQueryClient();

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['custom-allowances', companyId] });
    queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
  };

  const create = useApiMutation({
    mutationFn: createCustomAllowance,
    onSuccess: invalidate,
    showErrorToast: false,
  });

  const remove = useApiMutation({
    mutationFn: ({ id, activeCompanyId }) => deleteCustomAllowance(id, activeCompanyId),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  return {
    allowances: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    create,
    remove,
  };
}
