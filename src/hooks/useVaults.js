/**
 * useVaults — جلب الخزائن وCRUD كامل (إضافة/تعديل/أرشفة/حذف).
 * إبطال الكاش مركزي عبر دالة invalidate واحدة.
 */
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getVaults,
  createVault,
  updateVault,
  archiveVault,
  deleteVault,
} from '../services/api';

/**
 * @param {{ companyId: string, includeArchived?: boolean }} params
 */
export function useVaults({ companyId, includeArchived = false }) {
  const queryClient = useQueryClient();

  const { data: vaultsList = [], isLoading } = useQuery({
    queryKey: ['vaults', companyId, includeArchived],
    queryFn: async () => {
      const res = await getVaults(companyId, includeArchived);
      if (!res?.success) return [];
      const d = res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    placeholderData: (prev) => prev,
    enabled: !!companyId,
  });

  const salesChannels = useMemo(
    () => vaultsList.filter((v) => v.isSalesChannel && !v.isArchived),
    [vaultsList],
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['vaults', companyId] });

  const createMutation = useMutation({
    mutationFn: (body) => createVault({ ...body, companyId }),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateVault(id, body),
    onSuccess: invalidate,
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => archiveVault(id),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteVault(id),
    onSuccess: invalidate,
  });

  return {
    vaultsList,
    salesChannels,
    isLoading,
    create:  createMutation,
    update:  updateMutation,
    archive: archiveMutation,
    remove:  deleteMutation,
  };
}
