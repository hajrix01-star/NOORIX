/**
 * Company insight threshold settings — query + mutations (invalidates dashboard insights for same company).
 */
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  getInsightThresholds,
  patchInsightThresholds,
  resetInsightThresholds,
  type CompanyInsightThresholdsPayload,
  type PatchInsightThresholdsPayload,
} from '../../../services/reportingInsightThresholdsApi';
import { unwrapApiDataOr } from '../../../services/api';
import { reportingInsightThresholdsKeys } from '../../../services/queryKeys/reportingInsightThresholdsKeys';

export function invalidateInsightThresholdsAndDashboardInsights(
  queryClient: QueryClient,
  companyId: string,
): void {
  const id = String(companyId || '').trim();
  if (!id) return;
  queryClient.invalidateQueries({ queryKey: reportingInsightThresholdsKeys.company(id) });
  queryClient.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) &&
      q.queryKey[0] === 'reporting-insights' &&
      q.queryKey[1] === 'dashboard' &&
      q.queryKey[2] === id,
  });
}

export type UseCompanyInsightThresholdsOptions = {
  /** When false, skip GET (e.g. user cannot view thresholds). Default: true if companyId set */
  readEnabled?: boolean;
};

export function useCompanyInsightThresholds(
  companyId: string | null | undefined,
  options?: UseCompanyInsightThresholdsOptions,
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const id = String(companyId ?? '').trim();
  const readEnabled = options?.readEnabled !== false && !!id;

  const query = useApiQuery<
    { thresholds?: CompanyInsightThresholdsPayload },
    CompanyInsightThresholdsPayload
  >({
    queryKey: reportingInsightThresholdsKeys.company(id),
    queryFn: () => getInsightThresholds(id),
    select: (data) => {
      if (!data?.thresholds) {
        throw new Error(t('financialInsightThresholdsLoadError'));
      }
      return data.thresholds;
    },
    enabled: readEnabled,
    staleTime: 60_000,
    fallbackMessage: t('financialInsightThresholdsLoadError'),
  });

  const patchMutation = useApiMutation({
    mutationFn: async (body: PatchInsightThresholdsPayload) => {
      const res = await patchInsightThresholds(body);
      const data = unwrapApiDataOr(
        res,
        null,
        t('financialInsightThresholdsSaveError'),
      );
      return { success: true, data };
    },
    invalidateQueries: [],
    showErrorToast: true,
    errorToast: () => t('financialInsightThresholdsSaveError'),
    successToast: () => t('financialInsightThresholdsSaved'),
    onSuccess: (_data: unknown, variables: PatchInsightThresholdsPayload) => {
      invalidateInsightThresholdsAndDashboardInsights(queryClient, variables.companyId);
    },
  });

  const resetMutation = useApiMutation({
    mutationFn: async (cid: string) => {
      const res = await resetInsightThresholds(cid);
      const data = unwrapApiDataOr(
        res,
        null,
        t('financialInsightThresholdsResetError'),
      );
      return { success: true, data };
    },
    invalidateQueries: [],
    showErrorToast: true,
    errorToast: () => t('financialInsightThresholdsResetError'),
    successToast: () => t('financialInsightThresholdsResetDone'),
    onSuccess: (_data: unknown, cid: string) => {
      invalidateInsightThresholdsAndDashboardInsights(queryClient, cid);
    },
  });

  return {
    query,
    patchMutation,
    resetMutation,
    invalidateForCompany: (cid: string) => invalidateInsightThresholdsAndDashboardInsights(queryClient, cid),
  };
}
