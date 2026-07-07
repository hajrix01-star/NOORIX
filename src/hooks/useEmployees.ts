import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from './useApiMutation';
import { useApiListQuery, useApiQuery } from './useApiQuery';
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
} from '../services/api';
import { createAdvance } from '../services/api';
import { invalidateOnFinancialMutation } from '../utils/queryInvalidation';
import { employeeKeys, invoiceKeys, vaultKeys } from '../services/queryKeys';
import type { HrEmployee, HrMutationPayload } from '../types/api';

export type UseEmployeesOpts = { includeTerminated?: boolean; fetchEnabled?: boolean };

export function useEmployees(companyId: string, { includeTerminated = false, fetchEnabled = true }: UseEmployeesOpts = {}) {
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useApiListQuery<HrEmployee>({
    queryKey: employeeKeys.list(companyId, includeTerminated),
    queryFn: () => getEmployees(companyId, includeTerminated),
    fallbackMessage: 'Failed to load employees',
    enabled: !!companyId && fetchEnabled,
  });

  const createMutation = useApiMutation({
    mutationFn: createEmployee,
    invalidateQueries: [
      employeeKeys.byCompany(companyId),
      employeeKeys.pagedByCompany(companyId),
      invoiceKeys.root(),
      vaultKeys.root(),
    ],
    showErrorToast: false,
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }: { id: string; body: HrMutationPayload }) => updateEmployee(id, body, companyId),
    invalidateQueries: [
      employeeKeys.byCompany(companyId),
      employeeKeys.pagedByCompany(companyId),
      invoiceKeys.root(),
      vaultKeys.root(),
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

export function useEmployee(id: string | null | undefined, companyId: string | null | undefined) {
  const employeeId = id ?? '';
  const activeCompanyId = companyId ?? '';
  return useApiQuery<HrEmployee>({
    queryKey: employeeKeys.detail(employeeId, activeCompanyId),
    queryFn: () => getEmployee(employeeId, activeCompanyId),
    fallbackMessage: 'Failed to load employee',
    enabled: !!employeeId && !!activeCompanyId,
  });
}
