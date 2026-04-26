/**
 * useSuppliers — جلب الموردين وإضافتهم مع Caching/Invalidation تلقائي.
 * Single source of truth لبيانات الموردين.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from './useApiMutation';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, throwIfApiFailed } from '../services/api';

/**
 * @param {string} companyId
 * @param {{ pageSize?: number; q?: string }} [opts]
 */
export function useSuppliers(companyId, { pageSize = 200, q }: { pageSize?: number; q?: string } = {}) {
  const { data: raw = [], isLoading, isError, error } = useQuery({
    queryKey: ['suppliers', companyId, pageSize, q || ''],
    queryFn: async () => {
      const res = await getSuppliers(companyId, 1, pageSize, q);
      throwIfApiFailed(res, 'فشل تحميل الموردين');
      const d = res.data?.data ?? res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    enabled: !!companyId,
  });

  const suppliers = useMemo(() => raw.filter((s) => !s.isDeleted), [raw]);

  const createMutation = useApiMutation({
    mutationFn: createSupplier,
    invalidateQueries: [['suppliers', companyId]],
    showErrorToast: false,
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }) => updateSupplier(id, body),
    invalidateQueries: [['suppliers', companyId]],
    showErrorToast: false,
  });

  const deleteMutation = useApiMutation({
    mutationFn: deleteSupplier,
    invalidateQueries: [['suppliers', companyId]],
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
