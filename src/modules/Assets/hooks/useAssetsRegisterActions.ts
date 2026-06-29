import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { deleteCompanyAsset, throwIfApiFailed } from '../../../services/api';
import { assetKeys } from '../../../services/queryKeys';

export function useAssetsRegisterActions({
  companyId,
  canDelete,
  queryClient,
  showToast,
  t,
}: {
  companyId: string;
  canDelete: boolean;
  queryClient: QueryClient;
  showToast: (msg: string, variant?: 'success' | 'error') => void;
  t: (k: string) => string;
}) {
  const invalidateAssets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: assetKeys.root() });
  }, [queryClient]);

  const handleDelete = useCallback(
    async (row: { id?: string }) => {
      if (!canDelete || !row?.id) return;
      if (!confirm(t('assetDeleteConfirm'))) return;
      try {
        const res = await deleteCompanyAsset(row.id, companyId);
        throwIfApiFailed(res, t('delete'));
        invalidateAssets();
        showToast(t('savedSuccessfully') || 'تم الحذف');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : t('loadingError');
        showToast(msg, 'error');
      }
    },
    [canDelete, companyId, invalidateAssets, showToast, t],
  );

  return { handleDelete, invalidateAssets };
}
