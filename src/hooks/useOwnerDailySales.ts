/**
 * useOwnerDailySales — ملخصات مبيعات يومية لكل شركة ضمن شهر محدد (لوحة المالك)
 */
import { useQueries } from '@tanstack/react-query';
import { getDailySalesSummaries, throwIfApiFailed } from '../services/api';
import { ownerKeys } from '../services/queryKeys/owner';

function monthBounds(y: number, month1to12: number) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${y}-${pad(month1to12)}-01`;
  const endD = new Date(y, month1to12, 0);
  const end = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`;
  return { start, end };
}

/**
 * @param {{ companyIds: string[], year: number, month: number | null, enabled?: boolean }} params
 */
export function useOwnerDailySales({
  companyIds,
  year,
  month,
  enabled: externalEnabled = true,
}: {
  companyIds: string[];
  year: number;
  month: number | null;
  enabled?: boolean;
}) {
  const bounds = month && year ? monthBounds(year, month) : null;

  const ids = companyIds || [];
  const enabled = externalEnabled && !!(bounds && ids.length && month);

  const queries = useQueries({
    queries: ids.map((companyId) => ({
      queryKey: ownerKeys.dailySales(companyId, year, month),
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

  const isLoading = enabled && queries.some((q) => q.isLoading);
  const isError = enabled && queries.some((q) => q.isError);
  const error = queries.find((q) => q.error)?.error;

  const itemsByCompanyId: Record<string, unknown[]> = {};
  ids.forEach((cid, i) => {
    itemsByCompanyId[cid] = queries[i]?.data ?? [];
  });

  const dataStamp = queries.reduce((acc, q) => acc + (Number(q.dataUpdatedAt) || 0), 0);

  return { itemsByCompanyId, bounds, isLoading, isError, error, enabled, dataStamp };
}
