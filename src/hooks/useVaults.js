/**
 * useVaults — جلب الخزائن وCRUD كامل (إضافة/تعديل/أرشفة/حذف).
 * إبطال الكاش مركزي عبر دالة invalidate واحدة.
 */
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getVaults,
  getPaymentVaults,
  createVault,
  updateVault,
  archiveVault,
  deleteVault,
} from '../services/api';

/**
 * @param {{ companyId: string, includeArchived?: boolean, startDate?: string|null, endDate?: string|null }} params
 */
export function useVaults({ companyId, includeArchived = false, startDate = null, endDate = null }) {
  const queryClient = useQueryClient();

  const { data: vaultsList = [], isLoading, isFetching, isError } = useQuery({
    queryKey: ['vaults', companyId, includeArchived, startDate ?? '', endDate ?? ''],
    queryFn: async () => {
      const res = await getVaults(
        companyId,
        includeArchived,
        startDate || undefined,
        endDate || undefined,
      );
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل الخزائن');
      const d = res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    enabled: !!companyId,
  });

  const { data: paymentVaults = [], isLoading: paymentVaultsLoading } = useQuery({
    queryKey: ['payment-vaults', companyId],
    queryFn: async () => {
      const res = await getPaymentVaults(companyId);
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل خيارات الدفع');
      const d = res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    enabled: !!companyId,
  });

  const salesChannels = useMemo(
    () =>
      vaultsList.filter(
        (v) => v.isActive !== false && v.isSalesChannel && !v.isArchived,
      ),
    [vaultsList],
  );

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['vaults', companyId] }),
      queryClient.invalidateQueries({ queryKey: ['payment-vaults', companyId] }),
    ]);

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
    paymentVaults,
    isLoading: isLoading || paymentVaultsLoading,
    isFetching,
    isError,
    create:  createMutation,
    update:  updateMutation,
    archive: archiveMutation,
    remove:  deleteMutation,
  };
}
