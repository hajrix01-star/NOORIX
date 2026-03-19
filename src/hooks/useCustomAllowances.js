import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
      if (!res?.success) return [];
      const data = res.data;
      return Array.isArray(data) ? data : (data?.items ?? []);
    },
    enabled: !!companyId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['custom-allowances', companyId] });
    queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
  };

  const create = useMutation({
    mutationFn: createCustomAllowance,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: ({ id, activeCompanyId }) => deleteCustomAllowance(id, activeCompanyId),
    onSuccess: invalidate,
  });

  return {
    allowances: query.data ?? [],
    isLoading: query.isLoading,
    create,
    remove,
  };
}
