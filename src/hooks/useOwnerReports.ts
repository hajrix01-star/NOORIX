/**
 * useOwnerReports — جلب تقارير ربح وخسارة لعدة شركات (لوحة المالك)
 */
import { useQueries } from '@tanstack/react-query';
import { getGeneralProfitLossReport, throwIfApiFailed } from '../services/api';

export function useOwnerReports({ companyIds, year }: any) {
  const queries = useQueries({
    queries: (companyIds || []).map((companyId: any) => ({
      queryKey: ['reports', 'general-profit-loss', 'owner', companyId, year],
      queryFn: async () => {
        const res = await getGeneralProfitLossReport(companyId, year);
        throwIfApiFailed(res, 'Failed to load report');
        return { companyId, data: res.data };
      },
      enabled: !!companyId && !!year,
    })),
  });

  const isLoading = queries.some((q: any) => q.isLoading);
  const isError = queries.some((q: any) => q.isError);
  const error = queries.find((q: any) => q.error)?.error;
  const reportsByCompany = queries
    .filter((q: any) => q.data)
    .reduce<Record<string, unknown>>((acc: any, q: any) => {
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
