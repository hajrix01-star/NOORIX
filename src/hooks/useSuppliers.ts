import { useMemo } from 'react';
import { useApiMutation } from './useApiMutation';
import { useApiListQuery } from './useApiQuery';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../services/api';
import { supplierKeys } from '../services/queryKeys';
import type {
  SupplierCreatePayload,
  SupplierRecord,
  SupplierUpdatePayload,
} from '../modules/Suppliers/supplierTypes';

export type UseSuppliersOptions = {
  pageSize?: number;
  q?: string;
};

export function useSuppliers(companyId: string, { pageSize = 200, q }: UseSuppliersOptions = {}) {
  const { data: raw = [], isLoading, isError, error } = useApiListQuery<SupplierRecord>({
    queryKey: supplierKeys.list(companyId, pageSize, q || ''),
    queryFn: () => getSuppliers(companyId, 1, pageSize, q),
    fallbackMessage: 'فشل تحميل الموردين',
    enabled: !!companyId,
  });

  const suppliers = useMemo(() => raw.filter((supplier) => !supplier.isDeleted), [raw]);

  const createMutation = useApiMutation({
    mutationFn: (body: SupplierCreatePayload) => createSupplier(body),
    invalidateQueries: [supplierKeys.byCompany(companyId)],
    showErrorToast: false,
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }: { id: string; body: SupplierUpdatePayload }) => updateSupplier(id, body),
    invalidateQueries: [supplierKeys.byCompany(companyId)],
    showErrorToast: false,
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    invalidateQueries: [supplierKeys.byCompany(companyId)],
    showErrorToast: false,
  });

  return {
    suppliers,
    isLoading,
    isError,
    error,
    create: createMutation,
    update: updateMutation,
    remove: deleteMutation,
  };
}
