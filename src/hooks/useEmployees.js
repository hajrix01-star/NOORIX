/**
 * useEmployees — جلب الموظفين وإضافتهم وتعديلهم مع Caching/Invalidation تلقائي.
 * يدعم صرف السلفة عبر createAdvance.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  terminateEmployee,
} from '../services/api';
import { createAdvance } from '../services/financialApi';
import { invalidateOnFinancialMutation } from '../utils/queryInvalidation';

/**
 * @param {string} companyId
 * @param {{ includeTerminated?: boolean }} [opts]
 */
export function useEmployees(companyId, { includeTerminated = false } = {}) {
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', companyId, includeTerminated],
    queryFn: async () => {
      const res = await getEmployees(companyId, includeTerminated);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!companyId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['vaults'] });
  };

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateEmployee(id, body, companyId),
    onSuccess: invalidate,
  });

  const terminateMutation = useMutation({
    mutationFn: (id) => terminateEmployee(id, companyId),
    onSuccess: invalidate,
  });

  const advanceMutation = useMutation({
    mutationFn: createAdvance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      invalidateOnFinancialMutation(queryClient);
    },
  });

  return {
    employees,
    isLoading,
    create: createMutation,
    update: updateMutation,
    terminate: terminateMutation,
    createAdvance: advanceMutation,
  };
}

/**
 * @param {string} id
 * @param {string} companyId
 */
export function useEmployee(id, companyId) {
  return useQuery({
    queryKey: ['employee', id, companyId],
    queryFn: async () => {
      const res = await getEmployee(id, companyId);
      if (!res?.success) throw new Error(res.error || 'فشل تحميل الموظف');
      return res.data;
    },
    enabled: !!id && !!companyId,
  });
}
