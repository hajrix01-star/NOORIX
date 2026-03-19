/**
 * useSuppliers — جلب الموردين وإضافتهم مع Caching/Invalidation تلقائي.
 * Single source of truth لبيانات الموردين.
 */
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../services/api';

/**
 * @param {string} companyId
 * @param {{ pageSize?: number }} [opts]
 */
export function useSuppliers(companyId, { pageSize = 200 } = {}) {
  const queryClient = useQueryClient();

  const { data: raw = [], isLoading } = useQuery({
    queryKey: ['suppliers', companyId],
    queryFn: async () => {
      const res = await getSuppliers(companyId, 1, pageSize);
      if (!res?.success) return [];
      const d = res.data?.data ?? res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    enabled: !!companyId,
  });

  const suppliers = useMemo(() => raw.filter((s) => !s.isDeleted), [raw]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['suppliers', companyId] });

  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateSupplier(id, body),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: invalidate,
  });

  return {
    suppliers,
    isLoading,
    create: createMutation,
    update: updateMutation,
    remove: deleteMutation,
  };
}
