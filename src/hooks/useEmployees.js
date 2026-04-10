/**
 * useEmployees — جلب الموظفين وإضافتهم وتعديلهم مع Caching/Invalidation تلقائي.
 * يدعم صرف السلفة عبر createAdvance.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from './useApiMutation';
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  throwIfApiFailed,
} from '../services/api';
import { createAdvance } from '../services/financialApi';
import { invalidateOnFinancialMutation } from '../utils/queryInvalidation';

/**
 * @param {string} companyId
 * @param {{ includeTerminated?: boolean, fetchEnabled?: boolean }} [opts]
 */
export function useEmployees(companyId, { includeTerminated = false, fetchEnabled = true } = {}) {
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', companyId, includeTerminated],
    queryFn: async () => {
      const res = await getEmployees(companyId, includeTerminated);
      throwIfApiFailed(res, 'فشل تحميل الموظفين');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!companyId && fetchEnabled,
  });

  const createMutation = useApiMutation({
    mutationFn: createEmployee,
    invalidateQueries: [
      ['employees', companyId],
      ['employees-paged', companyId],
      ['invoices'],
      ['vaults'],
    ],
    showErrorToast: false,
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }) => updateEmployee(id, body, companyId),
    invalidateQueries: [
      ['employees', companyId],
      ['employees-paged', companyId],
      ['invoices'],
      ['vaults'],
    ],
    showErrorToast: false,
  });

  const advanceMutation = useApiMutation({
    mutationFn: createAdvance,
    invalidateQueries: [
      ['employees', companyId],
      ['employees-paged', companyId],
    ],
    showErrorToast: false,
    onSuccess: () => {
      invalidateOnFinancialMutation(queryClient);
    },
  });

  return {
    employees,
    isLoading,
    create: createMutation,
    update: updateMutation,
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
      throwIfApiFailed(res, 'فشل تحميل الموظف');
      return res.data;
    },
    enabled: !!id && !!companyId,
  });
}
