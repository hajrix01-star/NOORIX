/**
 * حزمة ملخصات المبيعات للوحة التحكم — طلب HTTP واحد (بدل عدة useSales).
 */
import { useQuery } from '@tanstack/react-query';
import { getDashboardSalesPack, throwIfApiFailed } from '../services/api';

/**
 * @param {{
 *   companyId: string,
 *   yearStart: string,
 *   yearEnd: string,
 *   dailyStart: string | null,
 *   dailyEnd: string | null,
 *   monthStart: string | null,
 *   monthEnd: string | null,
 *   enabled?: boolean,
 * }} p
 */
export function useDashboardSalesPack(p: any) {
  const {
    companyId,
    yearStart,
    yearEnd,
    dailyStart,
    dailyEnd,
    monthStart,
    monthEnd,
    enabled = true,
  } = p;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      'sales-dashboard-pack',
      companyId,
      yearStart,
      yearEnd,
      dailyStart,
      dailyEnd,
      monthStart,
      monthEnd,
    ],
    queryFn: async () => {
      const res = await getDashboardSalesPack({
        companyId,
        yearStart,
        yearEnd,
        dailyStart,
        dailyEnd,
        monthStart,
        monthEnd,
      });
      throwIfApiFailed(res, 'فشل تحميل بيانات المبيعات للوحة التحكم');
      const raw = res.data?.data ?? res.data;
      return {
        yearSummaries: raw?.yearSummaries ?? [],
        dailySummaries: raw?.dailySummaries ?? [],
        monthSummaries: raw?.monthSummaries ?? [],
      };
    },
    enabled: !!companyId && enabled,
  });

  return {
    yearSummaries: data?.yearSummaries ?? [],
    dailySummaries: data?.dailySummaries ?? [],
    monthSummaries: data?.monthSummaries ?? [],
    isLoading,
    isError,
    error,
  };
}
