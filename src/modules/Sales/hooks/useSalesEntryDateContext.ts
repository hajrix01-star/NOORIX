import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDailySalesSummaries, throwIfApiFailed } from '../../../services/api';
import { salesKeys } from '../../../services/queryKeys';
import { getSaudiToday, toYmd } from '../../../utils/saudiDate';
import {
  collectActiveShiftsOnDay,
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

  const lastEntryYmd = lastEntryQuery.data ?? null;

  const lastDaySummariesQuery = useQuery({
    queryKey: salesKeys.entryDay(companyId, lastEntryYmd ?? ''),
    queryFn: async () => {
      const res = await getDailySalesSummaries(
        companyId,
        lastEntryYmd!,
        lastEntryYmd!,
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
    enabled: !!companyId && !!lastEntryYmd,
    staleTime: 15_000,
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
    enabled: !!companyId && !!toYmd(txDate) && txDate !== lastEntryYmd,
    staleTime: 15_000,
  });

  const lastDayShifts = useMemo(
    () => collectActiveShiftsOnDay(
      lastDaySummariesQuery.data as Parameters<typeof collectActiveShiftsOnDay>[0],
    ),
    [lastDaySummariesQuery.data],
  );

  const daySummariesForTx = useMemo(() => {
    if (!toYmd(txDate)) return [];
    if (txDate === lastEntryYmd) {
      return (lastDaySummariesQuery.data ?? []) as Parameters<typeof findDuplicateShiftsForDate>[0];
    }
    return (daySummariesQuery.data ?? []) as Parameters<typeof findDuplicateShiftsForDate>[0];
  }, [txDate, lastEntryYmd, lastDaySummariesQuery.data, daySummariesQuery.data]);

  const suggestedDate = useMemo(
    () => suggestSalesEntryDate(todayYmd, lastEntryYmd, lastDayShifts),
    [todayYmd, lastEntryYmd, lastDayShifts],
  );

  const gapDaysResult = useMemo(
    () => listGapDaysBetween(lastEntryYmd, txDate),
    [lastEntryYmd, txDate],
  );

  const duplicateShifts = useMemo(
    () => findDuplicateShiftsForDate(daySummariesForTx, activeShifts),
    [daySummariesForTx, activeShifts],
  );

  const contextLoading = lastEntryQuery.isLoading
    || lastEntryQuery.isFetching
    || (!!lastEntryYmd && (lastDaySummariesQuery.isLoading || lastDaySummariesQuery.isFetching));

  const daySummariesLoading = (!!toYmd(txDate) && txDate !== lastEntryYmd)
    ? (daySummariesQuery.isLoading || daySummariesQuery.isFetching)
    : (!!lastEntryYmd && (lastDaySummariesQuery.isLoading || lastDaySummariesQuery.isFetching));

  return {
    todayYmd,
    lastEntryYmd,
    suggestedDate,
    gapDays: gapDaysResult.days,
    gapDaysTotalCount: gapDaysResult.totalCount,
    gapDaysTruncated: gapDaysResult.truncated,
    duplicateShifts,
    contextLoading,
    daySummariesLoading,
  };
}
