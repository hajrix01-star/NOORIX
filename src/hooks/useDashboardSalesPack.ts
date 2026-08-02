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
    dailyTotals: [],
    dailyChannels: [],
    channelBreakdown: [],
      monthDaily: [],
      monthAverage: undefined,
        weekdayAverages: [],
        dailyWeekly: [],
        dailyWeeklyComparison: [],
        shiftTotals: undefined,
        yearMonthlyDailyAverages: [],
        appSales: undefined,
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
      dailyTotals: Array.isArray(metrics?.dailyTotals) ? metrics.dailyTotals : [],
      dailyChannels: Array.isArray(metrics?.dailyChannels) ? metrics.dailyChannels : [],
      channelBreakdown: Array.isArray(metrics?.channelBreakdown) ? metrics.channelBreakdown : [],
        monthDaily: Array.isArray(metrics?.monthDaily) ? metrics.monthDaily : [],
        monthAverage: metrics?.monthAverage,
        weekdayAverages: Array.isArray(metrics?.weekdayAverages) ? metrics.weekdayAverages : [],
        dailyWeekly: Array.isArray(metrics?.dailyWeekly) ? metrics.dailyWeekly : [],
        dailyWeeklyComparison: Array.isArray(metrics?.dailyWeeklyComparison) ? metrics.dailyWeeklyComparison : [],
        shiftTotals: metrics?.shiftTotals,
        yearMonthlyDailyAverages: Array.isArray(metrics?.yearMonthlyDailyAverages) ? metrics.yearMonthlyDailyAverages : [],
        appSales: metrics?.appSales,
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
  baselineStart?: string | null;
  baselineEnd?: string | null;
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
    baselineStart = null,
    baselineEnd = null,
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
      baselineStart,
      baselineEnd,
    ),
    queryFn: () => getDashboardSalesPack({
      companyId,
      yearStart,
      yearEnd,
      dailyStart: dailyStart ?? undefined,
      dailyEnd: dailyEnd ?? undefined,
      monthStart: monthStart ?? undefined,
      monthEnd: monthEnd ?? undefined,
      baselineStart: baselineStart ?? undefined,
      baselineEnd: baselineEnd ?? undefined,
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
