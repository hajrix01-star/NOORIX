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
import { createAdvance } from '../services/api';
import { invalidateOnFinancialMutation } from '../utils/queryInvalidation';
import { employeeKeys } from '../services/queryKeys';

export type UseEmployeesOpts = { includeTerminated?: boolean; fetchEnabled?: boolean };

export function useEmployees(companyId: string, { includeTerminated = false, fetchEnabled = true }: UseEmployeesOpts = {}) {
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: employeeKeys.list(companyId, includeTerminated),
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
      employeeKeys.byCompany(companyId),
      employeeKeys.pagedByCompany(companyId),
      ['invoices'],
      ['vaults'],
    ],
    showErrorToast: false,
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }: any) => updateEmployee(id, body, companyId),
    invalidateQueries: [
      employeeKeys.byCompany(companyId),
      employeeKeys.pagedByCompany(companyId),
      ['invoices'],
      ['vaults'],
    ],
    showErrorToast: false,
  });

  const advanceMutation = useApiMutation({
    mutationFn: createAdvance,
    invalidateQueries: [
      employeeKeys.byCompany(companyId),
      employeeKeys.pagedByCompany(companyId),
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
export function useEmployee(id: any, companyId: any) {
  return useQuery({
    queryKey: employeeKeys.detail(id, companyId),
    queryFn: async () => {
      const res = await getEmployee(id, companyId);
      throwIfApiFailed(res, 'فشل تحميل الموظف');
      return res.data;
    },
    enabled: !!id && !!companyId,
  });
}
