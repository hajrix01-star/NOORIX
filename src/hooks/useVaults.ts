/**
 * useVaults — جلب الخزائن وCRUD كامل (إضافة/تعديل/أرشفة/حذف).
 * إبطال الكاش مركزي عبر دالة invalidate واحدة.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from './useApiMutation';
import { useApiListQuery } from './useApiQuery';
import {
  getVaults,
  getPaymentVaults,
  createVault,
  updateVault,
  reorderVaults,
  archiveVault,
  deleteVault,
} from '../services/api';
import { salesKeys, vaultKeys } from '../services/queryKeys';

/**
 * @param {{ companyId: string, includeArchived?: boolean, startDate?: string|null, endDate?: string|null }} params
 */
export function useVaults({ companyId, includeArchived = false, startDate = null, endDate = null }: any) {
  const queryClient = useQueryClient();

  const { data: vaultsList = [], isLoading, isFetching, isError } = useApiListQuery<any>({
    queryKey: vaultKeys.list(companyId, includeArchived, startDate ?? '', endDate ?? ''),
    queryFn: () =>
      getVaults(
        companyId,
        includeArchived,
        startDate || undefined,
        endDate || undefined,
      ),
    fallbackMessage: 'فشل تحميل الخزائن',
    enabled: !!companyId,
  });

  const { data: paymentVaults = [], isLoading: paymentVaultsLoading } = useApiListQuery<any>({
    queryKey: vaultKeys.paymentOptions(companyId),
    queryFn: () => getPaymentVaults(companyId),
    fallbackMessage: 'فشل تحميل خيارات الدفع',
    enabled: !!companyId,
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: vaultKeys.byCompany(companyId) }),
      queryClient.invalidateQueries({ queryKey: vaultKeys.paymentOptions(companyId) }),
      queryClient.invalidateQueries({ queryKey: salesKeys.channels(companyId) }),
    ]);

  const createMutation = useApiMutation({
    mutationFn: (body: any) => createVault({ ...body, companyId }),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }: any) => updateVault(id, body),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  const archiveMutation = useApiMutation({
    mutationFn: (id: any) => archiveVault(id),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: any) => deleteVault(id),
    onSuccess: invalidate,
    showErrorToast: false,
  });

  const reorderMutation = useApiMutation({
    mutationFn: (vaultIds: any) => reorderVaults(vaultIds),
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
    reorder: reorderMutation,
  };
}
