/**
 * useVaults — جلب الخزائن وCRUD كامل (إضافة/تعديل/أرشفة/حذف).
 * إبطال الكاش مركزي عبر دالة invalidate واحدة.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from './useApiMutation';
import {
  getVaults,
  getPaymentVaults,
  createVault,
  updateVault,
  archiveVault,
  deleteVault,
  throwIfApiFailed,
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
      throwIfApiFailed(res, 'فشل تحميل الخزائن');
      const d = res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    enabled: !!companyId,
  });

  const { data: paymentVaults = [], isLoading: paymentVaultsLoading } = useQuery({
    queryKey: ['payment-vaults', companyId],
    queryFn: async () => {
      const res = await getPaymentVaults(companyId);
      throwIfApiFailed(res, 'فشل تحميل خيارات الدفع');
      const d = res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    enabled: !!companyId,
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['vaults', companyId] }),
      queryClient.invalidateQueries({ queryKey: ['payment-vaults', companyId] }),
    ]);

  const createMutation = useApiMutation({
    mutationFn: (body) => createVault({ ...body, companyId }),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }) => updateVault(id, body),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  const archiveMutation = useApiMutation({
    mutationFn: (id) => archiveVault(id),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id) => deleteVault(id),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  return {
    vaultsList,
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
