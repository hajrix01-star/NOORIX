/**
 * HR ملخص اللوحة — طلب واحد موحّد (إجازات + إقامات + سلف بالتوازي).
 * يحلّ مشكلة "تغيّر أرقام بطاقة HR" الناتجة عن 3 طلبات منفصلة.
 */
import { useQuery } from '@tanstack/react-query';
import { getHrDashboardSummary, type HrDashboardSummaryData, throwIfApiFailed } from '../services/api';
import { hrKeys } from '../services/queryKeys/hr';

const EMPTY: HrDashboardSummaryData = {
  leavesCount: 0,
  expiringResidenciesCount: 0,
  outstandingAdvancesCount: 0,
  outstandingAdvancesAmount: 0,
};

export function useHrDashboardSummary(companyId: string) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: hrKeys.dashboardSummary(companyId),
    queryFn: async (): Promise<HrDashboardSummaryData> => {
      const res = await getHrDashboardSummary(companyId);
      throwIfApiFailed(res, 'فشل تحميل ملخص الموارد البشرية');
      const raw = res.data?.data ?? res.data;
      return {
        leavesCount:               Number(raw?.leavesCount               ?? 0),
        expiringResidenciesCount:  Number(raw?.expiringResidenciesCount  ?? 0),
        outstandingAdvancesCount:  Number(raw?.outstandingAdvancesCount  ?? 0),
        outstandingAdvancesAmount: Number(raw?.outstandingAdvancesAmount ?? 0),
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  return { data: data ?? EMPTY, isLoading, isError, error };
}
