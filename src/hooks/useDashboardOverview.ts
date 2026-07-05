import { getDashboardOverview, type DashboardOverviewParams } from '../services/api';
import { dashboardKeys } from '../services/queryKeys/dashboard';
import type { DashboardInsightsPayload } from '../services/reportingInsightsApi';
import type { PlReportLike } from '../modules/Dashboard/overview/utils/dashboardOverviewCalculations';
import { useApiQuery } from './useApiQuery';
import {
  hasRequiredDashboardPeriodParams,
  normalizeDashboardPeriodKeyInput,
} from '../services/domains/apiEndpoints/dashboard-period-query';

export type DashboardSummaryLike = {
  transactionDate?: string | null;
  totalAmount?: string | number | null;
  customerCount?: number | null;
  channels?: Array<{
    amount?: string | number | null;
    vault?: { nameAr?: string | null; nameEn?: string | null };
  }>;
};

export type DashboardPeriodDataLike = {
  topSuppliers?: Array<Record<string, unknown>>;
  purchaseCategoryBreakdown?: Array<Record<string, unknown>>;
  purchaseCategoryTotal?: unknown;
} | null;

export interface DashboardOverviewData {
  report: PlReportLike | null;
  salesPack: {
    yearSummaries: DashboardSummaryLike[];
    dailySummaries: DashboardSummaryLike[];
    monthSummaries: DashboardSummaryLike[];
  };
  insights: DashboardInsightsPayload | null;
  periodData: DashboardPeriodDataLike;
}

const EMPTY_OVERVIEW: DashboardOverviewData = {
  report: null,
  salesPack: { yearSummaries: [], dailySummaries: [], monthSummaries: [] },
  insights: null,
  periodData: null,
};

function normalizeDashboardOverview(rawResult: any): DashboardOverviewData {
  const raw = rawResult?.data ?? rawResult;
  return {
    report: (raw?.report ?? null) as PlReportLike | null,
    salesPack: {
      yearSummaries: (raw?.salesPack?.yearSummaries ?? []) as DashboardSummaryLike[],
      dailySummaries: (raw?.salesPack?.dailySummaries ?? []) as DashboardSummaryLike[],
      monthSummaries: (raw?.salesPack?.monthSummaries ?? []) as DashboardSummaryLike[],
    },
    insights: (raw?.insights ?? null) as DashboardInsightsPayload | null,
    periodData: (raw?.periodData ?? null) as DashboardPeriodDataLike,
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

  const { data, isLoading, isError, error } = useApiQuery<any, DashboardOverviewData>({
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
