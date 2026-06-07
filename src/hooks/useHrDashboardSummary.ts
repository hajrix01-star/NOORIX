/**
 * HR ملخص اللوحة — طلب واحد موحّد (إجازات + إقامات + سلف بالتوازي).
 * يحلّ مشكلة "تغيّر أرقام بطاقة HR" الناتجة عن 3 طلبات منفصلة.
 */
import { getHrDashboardSummary, type HrDashboardSummaryData } from '../services/api';
import { hrKeys } from '../services/queryKeys/hr';
import { useApiQueryOr } from './useApiQuery';

const EMPTY: HrDashboardSummaryData = {
  leavesCount: 0,
  expiringResidenciesCount: 0,
  outstandingAdvancesCount: 0,
  outstandingAdvancesAmount: 0,
  activeCount: 0,
  terminatedCount: 0,
  monthlyPayrollTotal: 0,
};

export function useHrDashboardSummary(companyId: string) {
  const { data, isLoading, isError, error } = useApiQueryOr<any, HrDashboardSummaryData>({
    queryKey: hrKeys.dashboardSummary(companyId),
    queryFn: () => getHrDashboardSummary(companyId),
    fallback: EMPTY,
    fallbackMessage: 'فشل تحميل ملخص الموارد البشرية',
    select: (payload): HrDashboardSummaryData => {
      const raw = payload?.data ?? payload;
      return {
        leavesCount:               Number(raw?.leavesCount               ?? 0),
        expiringResidenciesCount:  Number(raw?.expiringResidenciesCount  ?? 0),
        outstandingAdvancesCount:  Number(raw?.outstandingAdvancesCount  ?? 0),
        outstandingAdvancesAmount: Number(raw?.outstandingAdvancesAmount ?? 0),
        activeCount:               Number(raw?.activeCount               ?? 0),
        terminatedCount:           Number(raw?.terminatedCount           ?? 0),
        monthlyPayrollTotal:       Number(raw?.monthlyPayrollTotal       ?? 0),
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  return { data: data ?? EMPTY, isLoading, isError, error };
}
