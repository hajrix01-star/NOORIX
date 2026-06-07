/**
 * useSuppliers — جلب الموردين وإضافتهم مع Caching/Invalidation تلقائي.
 * Single source of truth لبيانات الموردين.
 */
import { useMemo } from 'react';
import { useApiMutation } from './useApiMutation';
import { useApiListQuery } from './useApiQuery';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../services/api';
import { supplierKeys } from '../services/queryKeys';

/**
 * @param {string} companyId
 * @param {{ pageSize?: number; q?: string }} [opts]
 */
export function useSuppliers(companyId: any, { pageSize = 200, q }: { pageSize?: number; q?: string } = {}) {
  const { data: raw = [], isLoading, isError, error } = useApiListQuery<any>({
    queryKey: supplierKeys.list(companyId, pageSize, q || ''),
    queryFn: () => getSuppliers(companyId, 1, pageSize, q),
    fallbackMessage: 'فشل تحميل الموردين',
    enabled: !!companyId,
  });

  const suppliers = useMemo(() => raw.filter((s: any) => !s.isDeleted), [raw]);

  const createMutation = useApiMutation({
    mutationFn: createSupplier,
    invalidateQueries: [supplierKeys.byCompany(companyId)],
    showErrorToast: false,
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }: any) => updateSupplier(id, body),
    invalidateQueries: [supplierKeys.byCompany(companyId)],
    showErrorToast: false,
  });

  const deleteMutation = useApiMutation({
    mutationFn: deleteSupplier,
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
