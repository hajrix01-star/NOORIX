/**
 * useOwnerReports — جلب تقارير ربح وخسارة لعدة شركات (لوحة المالك)
 */
import { useQueries } from '@tanstack/react-query';
import { getGeneralProfitLossReport } from '../services/api';

export function useOwnerReports({ companyIds, year }) {
  const queries = useQueries({
    queries: (companyIds || []).map((companyId) => ({
      queryKey: ['reports', 'general-profit-loss', 'owner', companyId, year],
      queryFn: async () => {
        const res = await getGeneralProfitLossReport(companyId, year);
        if (!res?.success) throw new Error(res?.error || 'Failed to load report');
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
    .reduce((acc, q) => {
      acc[q.data.companyId] = q.data.data;
      return acc;
    }, {});

  return {
    queries,
    isLoading,
    isError,
    error,
    reportsByCompany,
  };
}
