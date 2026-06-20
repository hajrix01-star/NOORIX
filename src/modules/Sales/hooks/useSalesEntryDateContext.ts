import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDailySalesSummaries, throwIfApiFailed } from '../../../services/api';
import { salesKeys } from '../../../services/queryKeys';
import { getSaudiToday, toYmd } from '../../../utils/saudiDate';
import {
  findDuplicateShiftsForDate,
  listGapDaysBetween,
  suggestSalesEntryDate,
} from '../utils/suggestSalesEntryDate';
import type { SalesShiftValue } from '../constants/salesShift';

export function useSalesEntryDateContext(
  companyId: string,
  txDate: string,
  activeShifts: SalesShiftValue[],
) {
  const todayYmd = getSaudiToday();

  const lastEntryQuery = useQuery({
    queryKey: salesKeys.entryLast(companyId),
    queryFn: async () => {
      const res = await getDailySalesSummaries(
        companyId,
        undefined,
        todayYmd,
        1,
        1,
        '',
        'transactionDate',
        'desc',
        false,
      );
      throwIfApiFailed(res, 'فشل تحميل آخر ملخص');
      const items = (res.data as { items?: { transactionDate?: string }[] } | undefined)?.items ?? [];
      const first = items[0];
      return first?.transactionDate ? toYmd(first.transactionDate) : null;
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const daySummariesQuery = useQuery({
    queryKey: salesKeys.entryDay(companyId, txDate),
    queryFn: async () => {
      const res = await getDailySalesSummaries(
        companyId,
        txDate,
        txDate,
        1,
        50,
        '',
        'transactionDate',
        'asc',
        false,
      );
      throwIfApiFailed(res, 'فشل تحميل ملخصات اليوم');
      return (res.data as { items?: unknown[] } | undefined)?.items ?? [];
    },
    enabled: !!companyId && !!toYmd(txDate),
    staleTime: 15_000,
  });

  const lastEntryYmd = lastEntryQuery.data ?? null;
  const suggestedDate = useMemo(
    () => suggestSalesEntryDate(todayYmd, lastEntryYmd),
    [todayYmd, lastEntryYmd],
  );

  const gapDays = useMemo(
    () => listGapDaysBetween(lastEntryYmd, txDate),
    [lastEntryYmd, txDate],
  );

  const duplicateShifts = useMemo(
    () => findDuplicateShiftsForDate(
      daySummariesQuery.data as Parameters<typeof findDuplicateShiftsForDate>[0],
      activeShifts,
    ),
    [daySummariesQuery.data, activeShifts],
  );

  const contextLoading = lastEntryQuery.isLoading || lastEntryQuery.isFetching;

  return {
    todayYmd,
    lastEntryYmd,
    suggestedDate,
    gapDays,
    duplicateShifts,
    contextLoading,
    daySummariesLoading: daySummariesQuery.isLoading,
  };
}
