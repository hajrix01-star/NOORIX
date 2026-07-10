import { getOwnerOverview } from '../services/api';
import { ownerKeys } from '../services/queryKeys/owner';
import type { OwnerOverviewData } from '../types/api';
import { useApiQuery } from './useApiQuery';

const EMPTY_COMPARISON = { rows: [], grandMonthlyTotals: [], grandTotal: 0 };

const EMPTY: OwnerOverviewData = {
  schemaVersion: 1,
  period: { year: 0, month: null },
  companies: [],
  kpis: [],
  companyRows: [],
  monthlyBuckets: [],
  comparison: {
    sales: EMPTY_COMPARISON,
    purchases: EMPTY_COMPARISON,
    expenses: EMPTY_COMPARISON,
    netProfit: EMPTY_COMPARISON,
  },
  monthlyPerformance: { sales: [], purchases: [], expenses: [], netProfit: [] },
  dailyPerformance: [],
  exportRows: [],
};

function normalizeOwnerOverview(raw: OwnerOverviewData): OwnerOverviewData {
  if (!raw || raw.schemaVersion !== 1) return EMPTY;
  return {
    ...raw,
    comparison: {
      ...EMPTY.comparison,
      ...raw.comparison,
    },
    monthlyPerformance: {
      ...EMPTY.monthlyPerformance,
      ...raw.monthlyPerformance,
    },
  };
}

export function useOwnerOverview(p: {
  companyIds: string[];
  year: number;
  month: number | null;
  enabled?: boolean;
}) {
  const { companyIds, year, month, enabled = true } = p;

  const { data, isLoading, isError, error } = useApiQuery<OwnerOverviewData, OwnerOverviewData>({
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
