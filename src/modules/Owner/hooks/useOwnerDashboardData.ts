import { useMemo } from 'react';
import { useOwnerOverview } from '../../../hooks/useOwnerOverview';
import { SERIES_RECHARTS_COLORS } from '../../../constants/kpiCardTheme';
import { buildOwnerCompanySeries } from '../utils/ownerDashboardDisplay';

type UseOwnerDashboardDataArgs = {
  idsToFetch: string[];
  year: number;
  chartMonthForDaily: number;
  lang: string;
};

export function useOwnerDashboardData({
  idsToFetch,
  year,
  chartMonthForDaily,
  lang,
}: UseOwnerDashboardDataArgs) {
  const { data: overview, isLoading, isError, error } = useOwnerOverview({
    companyIds: idsToFetch,
    year,
    month: chartMonthForDaily,
    enabled: idsToFetch.length > 0,
  });

  const companySeries = useMemo(
    () => buildOwnerCompanySeries(overview.companies, lang, SERIES_RECHARTS_COLORS),
    [overview.companies, lang],
  );

  return {
    overview,
    isLoading,
    isError,
    error,
    companySeries,
  };
}

export function queryErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return '';
}
