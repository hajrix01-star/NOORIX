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
      dailyTotals: [],
      dailyChannels: [],
      channelBreakdown: [],
        monthDaily: [],
        monthAverage: undefined,
        dailyWeekly: [],
        dailyWeeklyComparison: [],
        shiftTotals: undefined,
        yearMonthlyDailyAverages: [],
        appSales: undefined,
    },
  },
  insights: null,
  periodData: null,
  vaultActivity: {
    totalInflow: 0,
    totalOutflow: 0,
    periodResult: 0,
    transferVolume: 0,
    rows: [],
  },
  operationalOverview: {
    sales: 0,
    recurringCosts: { amount: 0, recordCount: 0, shareOfSalesPct: null, categories: [] },
    otherExpenses: { amount: 0, shareOfSalesPct: null, categories: [] },
    purchases: { amount: 0, shareOfSalesPct: null, categories: [] },
    operatingCosts: { amount: 0, shareOfSalesPct: null },
  },
  presentation: {
    kpiCards: [],
    timeline: {
      monthly: [],
      daily: [],
    },
    weeklyComparison: [],
    previousMonthAverage: null,
  },
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
        dailyTotals: Array.isArray(metrics?.dailyTotals) ? metrics.dailyTotals : [],
        dailyChannels: Array.isArray(metrics?.dailyChannels) ? metrics.dailyChannels : [],
        channelBreakdown: Array.isArray(metrics?.channelBreakdown) ? metrics.channelBreakdown : [],
        monthDaily: Array.isArray(metrics?.monthDaily) ? metrics.monthDaily : [],
        monthAverage: metrics?.monthAverage,
        dailyWeekly: Array.isArray(metrics?.dailyWeekly) ? metrics.dailyWeekly : [],
        dailyWeeklyComparison: Array.isArray(metrics?.dailyWeeklyComparison) ? metrics.dailyWeeklyComparison : [],
        shiftTotals: metrics?.shiftTotals,
        yearMonthlyDailyAverages: Array.isArray(metrics?.yearMonthlyDailyAverages) ? metrics.yearMonthlyDailyAverages : [],
        appSales: metrics?.appSales,
      },
    },
    insights: raw.insights ?? null,
    periodData: raw.periodData ?? null,
    vaultActivity: {
      totalInflow: raw.vaultActivity?.totalInflow ?? 0,
      totalOutflow: raw.vaultActivity?.totalOutflow ?? 0,
      periodResult: raw.vaultActivity?.periodResult ?? 0,
      transferVolume: raw.vaultActivity?.transferVolume ?? 0,
      rows: Array.isArray(raw.vaultActivity?.rows) ? raw.vaultActivity.rows : [],
    },
    operationalOverview: {
      sales: raw.operationalOverview?.sales ?? 0,
      recurringCosts: {
        amount: raw.operationalOverview?.recurringCosts?.amount ?? 0,
        recordCount: raw.operationalOverview?.recurringCosts?.recordCount ?? 0,
        shareOfSalesPct: raw.operationalOverview?.recurringCosts?.shareOfSalesPct ?? null,
        categories: Array.isArray(raw.operationalOverview?.recurringCosts?.categories)
          ? raw.operationalOverview.recurringCosts.categories
          : [],
      },
      otherExpenses: {
        amount: raw.operationalOverview?.otherExpenses?.amount ?? 0,
        shareOfSalesPct: raw.operationalOverview?.otherExpenses?.shareOfSalesPct ?? null,
        categories: Array.isArray(raw.operationalOverview?.otherExpenses?.categories)
          ? raw.operationalOverview.otherExpenses.categories
          : [],
      },
      purchases: {
        amount: raw.operationalOverview?.purchases?.amount ?? 0,
        shareOfSalesPct: raw.operationalOverview?.purchases?.shareOfSalesPct ?? null,
        categories: Array.isArray(raw.operationalOverview?.purchases?.categories)
          ? raw.operationalOverview.purchases.categories
          : [],
      },
      operatingCosts: {
        amount: raw.operationalOverview?.operatingCosts?.amount ?? 0,
        shareOfSalesPct: raw.operationalOverview?.operatingCosts?.shareOfSalesPct ?? null,
      },
    },
    presentation: {
      kpiCards: Array.isArray(raw.presentation?.kpiCards) ? raw.presentation.kpiCards : [],
      timeline: {
        monthly: Array.isArray(raw.presentation?.timeline?.monthly) ? raw.presentation.timeline.monthly : [],
        daily: Array.isArray(raw.presentation?.timeline?.daily) ? raw.presentation.timeline.daily : [],
      },
      weeklyComparison: Array.isArray(raw.presentation?.weeklyComparison) ? raw.presentation.weeklyComparison : [],
      previousMonthAverage: raw.presentation?.previousMonthAverage ?? null,
    },
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
    weeklyYearStart = null,
    weeklyYearEnd = null,
    weeklyStart = null,
    weeklyEnd = null,
    weeklyBaselineStart = null,
    weeklyBaselineEnd = null,
    previousMonthYearStart = null,
    previousMonthYearEnd = null,
    previousMonthStart = null,
    previousMonthEnd = null,
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
    weeklyYearStart,
    weeklyYearEnd,
    weeklyStart,
    weeklyEnd,
    weeklyBaselineStart,
    weeklyBaselineEnd,
    previousMonthYearStart,
    previousMonthYearEnd,
    previousMonthStart,
    previousMonthEnd,
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
      weeklyYearStart,
      weeklyYearEnd,
      weeklyStart,
      weeklyEnd,
      weeklyBaselineStart,
      weeklyBaselineEnd,
      previousMonthYearStart,
      previousMonthYearEnd,
      previousMonthStart,
      previousMonthEnd,
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
