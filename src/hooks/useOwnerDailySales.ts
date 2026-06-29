import { getDailySalesSummaries, throwIfApiFailed } from '../services/api';
import { ownerKeys } from '../services/queryKeys/owner';
import { useApiQueries } from './useApiQuery';

function monthBounds(y: number, month1to12: number) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${y}-${pad(month1to12)}-01`;
  const endD = new Date(y, month1to12, 0);
  const end = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`;
  return { start, end };
}

async function getOwnerDailySalesPageSet(companyId: string, start: string, end: string) {
  const pageSize = 150;
  let page = 1;
  const acc: unknown[] = [];

  for (let guard = 0; guard < 500; guard += 1) {
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
    throwIfApiFailed(res, 'Failed to load daily sales');
    const { items = [], total = 0 } = res.data || {};
    acc.push(...items);
    const t = Number(total) || 0;
    if (acc.length >= t || items.length < pageSize) break;
    page += 1;
  }

  return { success: true as const, data: acc };
}

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

  const queries = useApiQueries({
    queries: ids.map((companyId) => ({
      queryKey: ownerKeys.dailySales(companyId, year, month),
      queryFn: () => {
        if (!bounds) return Promise.resolve({ success: true as const, data: [] });
        return getOwnerDailySalesPageSet(companyId, bounds.start, bounds.end);
      },
      fallbackMessage: 'Failed to load daily sales',
      enabled: enabled && !!companyId,
    })),
  });

  const isLoading = enabled && queries.some((q) => q.isLoading);
  const isError = enabled && queries.some((q) => q.isError);
  const error = queries.find((q) => q.error)?.error;

  const itemsByCompanyId: Record<string, unknown[]> = {};
  ids.forEach((cid, i) => {
    itemsByCompanyId[cid] = (queries[i]?.data as unknown[]) ?? [];
  });

  const dataStamp = queries.reduce((acc, q) => acc + (Number(q.dataUpdatedAt) || 0), 0);

  return { itemsByCompanyId, bounds, isLoading, isError, error, enabled, dataStamp };
}
