/**
 * useOwnerDailySales — ملخصات مبيعات يومية لكل شركة ضمن شهر محدد (لوحة المالك)
 */
import { useQueries } from '@tanstack/react-query';
import { getDailySalesSummaries, throwIfApiFailed } from '../services/api';

function monthBounds(y: any, month1to12: any) {
  const pad = (n: any) => String(n).padStart(2, '0');
  const start = `${y}-${pad(month1to12)}-01`;
  const endD = new Date(y, month1to12, 0);
  const end = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`;
  return { start, end };
}

/**
 * @param {{ companyIds: string[], year: number, month: number | null, enabled?: boolean }} params
 */
export function useOwnerDailySales({ companyIds, year, month, enabled: externalEnabled = true }: any) {
  const bounds = month && year ? monthBounds(year, month) : null;

  const ids = companyIds || [];
  const enabled = externalEnabled && !!(bounds && ids.length && month);

  const queries = useQueries({
    queries: ids.map((companyId: any) => ({
      queryKey: ['owner-daily-sales', companyId, year, month],
      queryFn: async () => {
        if (!bounds) throw new Error('missing month bounds');
        const { start, end } = bounds;
        const pageSize = 150;
        let page = 1;
        const acc = [];
        for (let guard = 0; guard < 500; guard++) {
          const res = await getDailySalesSummaries(
            companyId,
            start,
            end,
            page,
            pageSize,
            undefined,
            'transactionDate',
            'asc',
            false,
          );
          throwIfApiFailed(res, 'فشل تحميل المبيعات اليومية');
          const { items = [], total = 0 } = res.data || {};
          acc.push(...items);
          const t = Number(total) || 0;
          if (acc.length >= t || items.length < pageSize) break;
          page += 1;
        }
        return acc;
      },
      enabled: enabled && !!companyId,
    })),
  });

  const isLoading = enabled && queries.some((q: any) => q.isLoading);
  const isError = enabled && queries.some((q: any) => q.isError);
  const error = queries.find((q: any) => q.error)?.error;

  const itemsByCompanyId: Record<string, any> = {};
  ids.forEach((cid: any, i: any) => {
    itemsByCompanyId[cid] = queries[i]?.data ?? [];
  });

  const dataStamp = queries.reduce((acc: any, q: any) => acc + (Number(q.dataUpdatedAt) || 0), 0);

  return { itemsByCompanyId, bounds, isLoading, isError, error, enabled, dataStamp };
}
