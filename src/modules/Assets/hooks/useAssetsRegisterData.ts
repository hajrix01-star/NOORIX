import { useApiQuery } from '../../../hooks/useApiQuery';
import { getCompanyAssets, getPendingWarrantyInvoices } from '../../../services/api';
import { assetKeys } from '../../../services/queryKeys';
import type { AssetRegisterPage, AssetWarrantyFilter, PendingWarrantyInvoiceRow } from '../../../types/api';
import { normalizeAssetRegisterPage, normalizePendingWarrantyRows } from '../assetsRegisterModel';

export function useAssetsRegisterData(
  companyId: string,
  warrantyFilter: AssetWarrantyFilter,
  debouncedQ: string,
  page: number,
  pageSize: number,
  loadingErrorLabel: string,
) {
  const registerQuery = useApiQuery<AssetRegisterPage | undefined>({
    queryKey: assetKeys.register(companyId, warrantyFilter, debouncedQ, page, pageSize),
    queryFn: () => getCompanyAssets(companyId, {
        warrantyFilter,
        q: debouncedQ || undefined,
        page,
        pageSize,
      }),
    enabled: !!companyId,
    fallbackMessage: loadingErrorLabel,
  });

  const pendingQuery = useApiQuery<PendingWarrantyInvoiceRow[] | undefined>({
    queryKey: assetKeys.pendingWarranty(companyId),
    queryFn: () => getPendingWarrantyInvoices(companyId),
    enabled: !!companyId,
    fallbackMessage: loadingErrorLabel,
  });

  const registerPage = normalizeAssetRegisterPage(registerQuery.data);
  const pendingRows = normalizePendingWarrantyRows(pendingQuery.data);

  return {
    items: registerPage.items,
    total: registerPage.total,
    sumAll: registerPage.sumAcquisitionCostFiltered,
    isLoading: registerQuery.isLoading,
    isError: registerQuery.isError,
    error: registerQuery.error,
    refetch: registerQuery.refetch,
    pendingRows,
    pendingLoading: pendingQuery.isLoading,
  };
}
