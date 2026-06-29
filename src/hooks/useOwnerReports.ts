import { getGeneralProfitLossReport } from '../services/api';
import { ownerKeys } from '../services/queryKeys/owner';
import { useApiQueries } from './useApiQuery';

export function useOwnerReports({ companyIds, year }: { companyIds: string[]; year: number }) {
  const ids = companyIds || [];
  const queries = useApiQueries({
    queries: ids.map((companyId) => ({
      queryKey: ownerKeys.reports(companyId, year),
      queryFn: () => getGeneralProfitLossReport(companyId, year),
      fallbackMessage: 'Failed to load report',
      enabled: !!companyId && !!year,
      select: (data: unknown) => ({ companyId, data }),
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const error = queries.find((q) => q.error)?.error;
  const reportsByCompany = queries
    .filter((q) => q.data)
    .reduce<Record<string, unknown>>((acc, q) => {
      const row = q.data as { companyId: string; data: unknown };
      acc[row.companyId] = row.data;
      return acc;
    }, {});

  return {
    isLoading,
    isError,
    error,
    reportsByCompany,
  };
}
