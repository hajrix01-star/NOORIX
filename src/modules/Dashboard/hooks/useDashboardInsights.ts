/**
 * رؤى لوحة التحكم — استعلام React Query فقط (لا واجهة هنا).
 */
import { useQuery } from '@tanstack/react-query';
import {
  getDashboardInsights,
  type DashboardInsightsPayload,
  type GetDashboardInsightsParams,
} from '../../../services/reportingInsightsApi';
import { throwIfApiFailed } from '../../../services/api';
import { reportingInsightsKeys } from '../../../services/queryKeys/reportingInsightsKeys';

function hasRequiredInsightsInputs(p: GetDashboardInsightsParams): boolean {
  const id = String(p.companyId ?? '').trim();
  const ys = String(p.yearStart ?? '').trim();
  const ye = String(p.yearEnd ?? '').trim();
  const ps = String(p.periodStart ?? '').trim();
  const pe = String(p.periodEnd ?? '').trim();
  const y = p.year;
  return (
    !!id &&
    Number.isFinite(y) &&
    y >= 2000 &&
    y <= 2100 &&
    !!ys &&
    !!ye &&
    !!ps &&
    !!pe
  );
}

export type UseDashboardInsightsParams = GetDashboardInsightsParams & {
  enabled?: boolean;
};

export function useDashboardInsights(params: UseDashboardInsightsParams) {
  const { enabled = true, ...rest } = params;

  const queryKeyInput = {
    companyId: rest.companyId,
    year: rest.year,
    yearStart: rest.yearStart,
    yearEnd: rest.yearEnd,
    dailyStart: rest.dailyStart ?? null,
    dailyEnd: rest.dailyEnd ?? null,
    monthStart: rest.monthStart ?? null,
    monthEnd: rest.monthEnd ?? null,
    periodStart: rest.periodStart,
    periodEnd: rest.periodEnd,
    selectedMonth: rest.selectedMonth ?? null,
    includeCancelledSales: rest.includeCancelledSales === true,
  };

  return useQuery({
    queryKey: reportingInsightsKeys.dashboard(queryKeyInput),
    queryFn: async (): Promise<DashboardInsightsPayload> => {
      const res = await getDashboardInsights(rest);
      throwIfApiFailed(res, 'فشل تحميل رؤى لوحة التحكم');
      return res.data as DashboardInsightsPayload;
    },
    enabled: hasRequiredInsightsInputs(rest) && enabled,
    staleTime: 60_000,
  });
}
