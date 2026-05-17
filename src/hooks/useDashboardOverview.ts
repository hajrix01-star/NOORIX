/**
 * لوحة التحكم — طلب واحد موحّد بدلاً من 4 طلبات منفصلة.
 *
 * يحلّ مشكلة "تغيّر الأرقام": الواجهة تعرض skeleton حتى تكتمل
 * جميع البيانات (P&L + Sales Pack + Insights + Period Analytics)
 * دفعةً واحدة دون خطر عرض بيانات متناقضة من مصادر اكتملت بترتيب مختلف.
 */
import { useQuery } from '@tanstack/react-query';
import { getDashboardOverview, type DashboardOverviewParams } from '../services/api';
import { throwIfApiFailed } from '../services/api';
import { dashboardKeys } from '../services/queryKeys/dashboard';
import type { DashboardInsightsPayload } from '../services/reportingInsightsApi';
import type { PlReportLike } from '../modules/Dashboard/overview/utils/dashboardOverviewCalculations';

/** يُطابق SummaryLike المستخدم داخل dashboardOverviewBuilders */
export type DashboardSummaryLike = {
  transactionDate?: string | null;
  totalAmount?: string | number | null;
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

  const { data, isLoading, isError, error } = useQuery({
    queryKey: dashboardKeys.overview(
      companyId,
      year,
      yearStart,
      yearEnd,
      periodStart,
      periodEnd,
      dailyStart ?? null,
      dailyEnd ?? null,
      monthStart ?? null,
      monthEnd ?? null,
      selectedMonth ?? null,
      includeCancelledSales ?? false,
    ),
    queryFn: async (): Promise<DashboardOverviewData> => {
      const res = await getDashboardOverview({
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
      });
      throwIfApiFailed(res, 'فشل تحميل بيانات لوحة التحكم');
      const raw = res.data?.data ?? res.data;
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
    },
    enabled: !!companyId && !!year && !!yearStart && !!yearEnd && !!periodStart && !!periodEnd && enabled,
  });

  return {
    data: data ?? EMPTY_OVERVIEW,
    isLoading,
    isError,
    error,
  };
}
