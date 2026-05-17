/**
 * لوحة المالك — طلب واحد موحّد بدلاً من N×2 طلبات منفصلة.
 *
 * يحلّ مشكلة "تغيّر الأرقام": P&L لكل شركة + مبيعاتها اليومية
 * تصل كلها في رد واحد، لا تظهر أرقام حتى تكتمل جميع البيانات.
 */
import { useQuery } from '@tanstack/react-query';
import { getOwnerOverview, throwIfApiFailed } from '../services/api';
import { ownerKeys } from '../services/queryKeys/owner';

export interface OwnerOverviewData {
  reportsByCompany: Record<string, unknown>;
  dailySalesByCompany: Record<string, unknown[]>;
}

const EMPTY: OwnerOverviewData = { reportsByCompany: {}, dailySalesByCompany: {} };

export function useOwnerOverview(p: {
  companyIds: string[];
  year: number;
  month: number | null;
  enabled?: boolean;
}) {
  const { companyIds, year, month, enabled = true } = p;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ownerKeys.overview(companyIds, year, month),
    queryFn: async (): Promise<OwnerOverviewData> => {
      const res = await getOwnerOverview({ companyIds, year, month });
      throwIfApiFailed(res, 'فشل تحميل بيانات لوحة المالك');
      const raw = res.data?.data ?? res.data;
      return {
        reportsByCompany:   (raw?.reportsByCompany   ?? {}) as Record<string, unknown>,
        dailySalesByCompany: (raw?.dailySalesByCompany ?? {}) as Record<string, unknown[]>,
      };
    },
    enabled: !!companyIds.length && !!year && enabled,
  });

  return {
    data:      data ?? EMPTY,
    isLoading,
    isError,
    error,
  };
}
