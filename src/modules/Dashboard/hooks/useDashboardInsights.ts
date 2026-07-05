/**
 * رؤى لوحة التحكم — استعلام React Query فقط (لا واجهة هنا).
 */
import { useApiQuery } from '../../../hooks/useApiQuery';
import {
  getDashboardInsights,
  type DashboardInsightsPayload,
  type GetDashboardInsightsParams,
} from '../../../services/reportingInsightsApi';
import { reportingInsightsKeys } from '../../../services/queryKeys/reportingInsightsKeys';
import {
  hasRequiredDashboardPeriodParams,
  normalizeDashboardPeriodKeyInput,
} from '../../../services/domains/apiEndpoints/dashboard-period-query';

export type UseDashboardInsightsParams = GetDashboardInsightsParams & {
  enabled?: boolean;
};

export function useDashboardInsights(params: UseDashboardInsightsParams) {
  const { enabled = true, ...rest } = params;
  const queryKeyInput = normalizeDashboardPeriodKeyInput(rest);

  return useApiQuery<DashboardInsightsPayload>({
    queryKey: reportingInsightsKeys.dashboard(queryKeyInput),
    queryFn: () => getDashboardInsights(rest),
    enabled: hasRequiredDashboardPeriodParams(rest) && enabled,
    fallbackMessage: 'فشل تحميل رؤى لوحة التحكم',
    staleTime: 60_000,
  });
}
