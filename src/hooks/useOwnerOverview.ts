import { getOwnerOverview } from '../services/api';
import { ownerKeys } from '../services/queryKeys/owner';
import { useApiQuery } from './useApiQuery';

export interface OwnerOverviewData {
  reportsByCompany: Record<string, unknown>;
  dailySalesByCompany: Record<string, unknown[]>;
}

const EMPTY: OwnerOverviewData = { reportsByCompany: {}, dailySalesByCompany: {} };

function normalizeOwnerOverview(rawResult: any): OwnerOverviewData {
  const raw = rawResult?.data ?? rawResult;
  return {
    reportsByCompany: (raw?.reportsByCompany ?? {}) as Record<string, unknown>,
    dailySalesByCompany: (raw?.dailySalesByCompany ?? {}) as Record<string, unknown[]>,
  };
}

export function useOwnerOverview(p: {
  companyIds: string[];
  year: number;
  month: number | null;
  enabled?: boolean;
}) {
  const { companyIds, year, month, enabled = true } = p;

  const { data, isLoading, isError, error } = useApiQuery<any, OwnerOverviewData>({
    queryKey: ownerKeys.overview(companyIds, year, month),
    queryFn: () => getOwnerOverview({ companyIds, year, month }),
    fallbackMessage: 'Failed to load owner overview',
    enabled: !!companyIds.length && !!year && enabled,
    select: normalizeOwnerOverview,
  });

  return {
    data: data ?? EMPTY,
    isLoading,
    isError,
    error,
  };
}
