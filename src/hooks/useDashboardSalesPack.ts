import { getDashboardSalesPack } from '../services/api';
import { dashboardKeys } from '../services/queryKeys/dashboard';
import { useApiQuery } from './useApiQuery';

type DashboardSalesPackData = {
  yearSummaries: any[];
  dailySummaries: any[];
  monthSummaries: any[];
};

function normalizeSalesPack(rawResult: any): DashboardSalesPackData {
  const raw = rawResult?.data ?? rawResult;
  return {
    yearSummaries: raw?.yearSummaries ?? [],
    dailySummaries: raw?.dailySummaries ?? [],
    monthSummaries: raw?.monthSummaries ?? [],
  };
}

export function useDashboardSalesPack(p: {
  companyId: string;
  yearStart: string;
  yearEnd: string;
  dailyStart: string | null;
  dailyEnd: string | null;
  monthStart: string | null;
  monthEnd: string | null;
  enabled?: boolean;
}) {
  const {
    companyId,
    yearStart,
    yearEnd,
    dailyStart,
    dailyEnd,
    monthStart,
    monthEnd,
    enabled = true,
  } = p;

  const { data, isLoading, isError, error } = useApiQuery<any, DashboardSalesPackData>({
    queryKey: dashboardKeys.salesPack(
      companyId,
      yearStart,
      yearEnd,
      dailyStart,
      dailyEnd,
      monthStart,
      monthEnd,
    ),
    queryFn: () => getDashboardSalesPack({
      companyId,
      yearStart,
      yearEnd,
      dailyStart: dailyStart ?? undefined,
      dailyEnd: dailyEnd ?? undefined,
      monthStart: monthStart ?? undefined,
      monthEnd: monthEnd ?? undefined,
    }),
    fallbackMessage: 'Failed to load dashboard sales pack',
    enabled: !!companyId && enabled,
    select: normalizeSalesPack,
  });

  return {
    yearSummaries: data?.yearSummaries ?? [],
    dailySummaries: data?.dailySummaries ?? [],
    monthSummaries: data?.monthSummaries ?? [],
    isLoading,
    isError,
    error,
  };
}
