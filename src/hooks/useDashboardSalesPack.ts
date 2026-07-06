import { getDashboardSalesPack } from '../services/api';
import { dashboardKeys } from '../services/queryKeys/dashboard';
import type { DashboardSalesPackData } from '../types/api/domains/dashboard';
import { useApiQuery } from './useApiQuery';

const EMPTY_SALES_PACK: DashboardSalesPackData = {
  yearSummaries: [],
  dailySummaries: [],
  monthSummaries: [],
  metrics: {
    yearDaily: [],
    yearChannels: [],
    dailyDaily: [],
    dailyChannels: [],
    monthDaily: [],
    monthAverage: undefined,
    dailyWeekly: [],
    yearMonthlyDailyAverages: [],
  },
};

function normalizeSalesPack(raw: DashboardSalesPackData | null | undefined): DashboardSalesPackData {
  if (!raw) return EMPTY_SALES_PACK;
  const metrics = raw.metrics ?? EMPTY_SALES_PACK.metrics;
  return {
    yearSummaries: Array.isArray(raw.yearSummaries) ? raw.yearSummaries : [],
    dailySummaries: Array.isArray(raw.dailySummaries) ? raw.dailySummaries : [],
    monthSummaries: Array.isArray(raw.monthSummaries) ? raw.monthSummaries : [],
    metrics: {
      yearDaily: Array.isArray(metrics?.yearDaily) ? metrics.yearDaily : [],
      yearChannels: Array.isArray(metrics?.yearChannels) ? metrics.yearChannels : [],
      dailyDaily: Array.isArray(metrics?.dailyDaily) ? metrics.dailyDaily : [],
      dailyChannels: Array.isArray(metrics?.dailyChannels) ? metrics.dailyChannels : [],
      monthDaily: Array.isArray(metrics?.monthDaily) ? metrics.monthDaily : [],
      monthAverage: metrics?.monthAverage,
      dailyWeekly: Array.isArray(metrics?.dailyWeekly) ? metrics.dailyWeekly : [],
      yearMonthlyDailyAverages: Array.isArray(metrics?.yearMonthlyDailyAverages) ? metrics.yearMonthlyDailyAverages : [],
    },
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

  const { data, isLoading, isError, error } = useApiQuery<DashboardSalesPackData, DashboardSalesPackData>({
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
    metrics: data?.metrics ?? EMPTY_SALES_PACK.metrics,
    isLoading,
    isError,
    error,
  };
}
