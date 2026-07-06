import { getDashboardOverview, type DashboardOverviewParams } from '../services/api';
import { dashboardKeys } from '../services/queryKeys/dashboard';
import type { DashboardOverviewData } from '../types/api/domains/dashboard';
import { useApiQuery } from './useApiQuery';
import {
  hasRequiredDashboardPeriodParams,
  normalizeDashboardPeriodKeyInput,
} from '../services/domains/apiEndpoints/dashboard-period-query';

const EMPTY_OVERVIEW: DashboardOverviewData = {
  report: null,
  salesPack: {
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
  },
  insights: null,
  periodData: null,
};

function normalizeDashboardOverview(raw: DashboardOverviewData | null | undefined): DashboardOverviewData {
  if (!raw) return EMPTY_OVERVIEW;
  const salesPack = raw.salesPack ?? EMPTY_OVERVIEW.salesPack;
  const metrics = salesPack.metrics ?? EMPTY_OVERVIEW.salesPack.metrics;
  return {
    report: raw.report ?? null,
    salesPack: {
      yearSummaries: Array.isArray(salesPack.yearSummaries) ? salesPack.yearSummaries : [],
      dailySummaries: Array.isArray(salesPack.dailySummaries) ? salesPack.dailySummaries : [],
      monthSummaries: Array.isArray(salesPack.monthSummaries) ? salesPack.monthSummaries : [],
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
    },
    insights: raw.insights ?? null,
    periodData: raw.periodData ?? null,
  };
}

export function useDashboardOverview(
  p: DashboardOverviewParams & { enabled?: boolean },
) {
  const {
    companyId,
    year,
    yearStart,
    yearEnd,
    periodStart,
    periodEnd,
    dailyStart = null,
    dailyEnd = null,
    monthStart = null,
    monthEnd = null,
    selectedMonth = null,
    includeCancelledSales = false,
    enabled = true,
  } = p;
  const dashboardPeriodParams = {
    companyId,
    year,
    yearStart,
    yearEnd,
    periodStart,
    periodEnd,
    dailyStart,
    dailyEnd,
    monthStart,
    monthEnd,
    selectedMonth,
    includeCancelledSales,
  };
  const queryKeyInput = normalizeDashboardPeriodKeyInput(dashboardPeriodParams);

  const { data, isLoading, isError, error } = useApiQuery<DashboardOverviewData, DashboardOverviewData>({
    queryKey: dashboardKeys.overview(queryKeyInput),
    queryFn: () => getDashboardOverview({
      companyId,
      year,
      yearStart,
      yearEnd,
      periodStart,
      periodEnd,
      dailyStart,
      dailyEnd,
      monthStart,
      monthEnd,
      selectedMonth,
      includeCancelledSales,
    }),
    fallbackMessage: 'Failed to load dashboard overview',
    enabled: hasRequiredDashboardPeriodParams(dashboardPeriodParams) && enabled,
    select: normalizeDashboardOverview,
  });

  return {
    data: data ?? EMPTY_OVERVIEW,
    isLoading,
    isError,
    error,
  };
}
