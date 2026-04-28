/**
 * useOwnerReports — جلب تقارير ربح وخسارة لعدة شركات (لوحة المالك)
 */
import { useQueries } from '@tanstack/react-query';
import { getGeneralProfitLossReport, throwIfApiFailed } from '../services/api';
import { ownerKeys } from '../services/queryKeys/owner';

export function useOwnerReports({ companyIds, year }: { companyIds: string[]; year: number }) {
  const ids = companyIds || [];
  const queries = useQueries({
    queries: ids.map((companyId) => ({
      queryKey: ownerKeys.reports(companyId, year),
      queryFn: async () => {
        const res = await getGeneralProfitLossReport(companyId, year);
        throwIfApiFailed(res, 'Failed to load report');
        return { companyId, data: res.data };
      },
      enabled: !!companyId && !!year,
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
