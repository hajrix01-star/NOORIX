import { useApiQuery } from '../../../hooks/useApiQuery';
import { getCompanyAssets, getPendingWarrantyInvoices } from '../../../services/api';
import { assetKeys } from '../../../services/queryKeys';
import { mapPendingList, mapRegisterListResponse, type RegisterListResponse } from '../utils/assetsRegisterMappers';

export function useAssetsRegisterData(
  companyId: string,
  warrantyFilter: string,
  debouncedQ: string,
  page: number,
  pageSize: number,
  loadingErrorLabel: string,
) {
  const registerQuery = useApiQuery<RegisterListResponse | undefined>({
    queryKey: assetKeys.register(companyId, warrantyFilter, debouncedQ, page, pageSize),
    queryFn: () => getCompanyAssets(companyId, {
        warrantyFilter: warrantyFilter === 'all' ? undefined : warrantyFilter,
        q: debouncedQ || undefined,
        page,
        pageSize,
      }),
    enabled: !!companyId,
    fallbackMessage: loadingErrorLabel,
  });

  const pendingQuery = useApiQuery<any>({
    queryKey: assetKeys.pendingWarranty(companyId),
    queryFn: () => getPendingWarrantyInvoices(companyId),
    enabled: !!companyId,
    fallbackMessage: loadingErrorLabel,
  });

  const { items, total, sumAll } = mapRegisterListResponse(registerQuery.data);
  const pendingRows = mapPendingList(pendingQuery.data);

  return {
    items,
    total,
    sumAll,
    isLoading: registerQuery.isLoading,
    isError: registerQuery.isError,
    error: registerQuery.error,
    refetch: registerQuery.refetch,
    pendingRows,
    pendingLoading: pendingQuery.isLoading,
  };
}
