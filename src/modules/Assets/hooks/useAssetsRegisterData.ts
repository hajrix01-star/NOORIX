import { useQuery } from '@tanstack/react-query';
import { getCompanyAssets, getPendingWarrantyInvoices } from '../../../services/api';
import { assertApiOk } from '../../../utils/apiResponse';
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
  const registerQuery = useQuery({
    queryKey: assetKeys.register(companyId, warrantyFilter, debouncedQ, page, pageSize),
    queryFn: async () => {
      const res = await getCompanyAssets(companyId, {
        warrantyFilter: warrantyFilter === 'all' ? undefined : warrantyFilter,
        q: debouncedQ || undefined,
        page,
        pageSize,
      });
      assertApiOk(res, loadingErrorLabel);
      return res.data as RegisterListResponse | undefined;
    },
    enabled: !!companyId,
  });

  const pendingQuery = useQuery({
    queryKey: assetKeys.pendingWarranty(companyId),
    queryFn: async () => {
      const res = await getPendingWarrantyInvoices(companyId);
      assertApiOk(res, loadingErrorLabel);
      return res.data;
    },
    enabled: !!companyId,
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
