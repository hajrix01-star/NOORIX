import { useMemo } from 'react';
import { getDailySalesSummaries } from '../../../services/api';
import { useApiListQuery } from '../../../hooks/useApiQuery';
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

  const lastEntryQuery = useApiListQuery<{ transactionDate?: string }, string | null>({
    queryKey: salesKeys.entryLast(companyId),
    queryFn: () =>
      getDailySalesSummaries(
        companyId,
        undefined,
        todayYmd,
        1,
        1,
        '',
        'transactionDate',
        'desc',
        false,
      ),
    fallbackMessage: 'فشل تحميل آخر ملخص',
    select: (items) => {
      const first = items[0];
      return first?.transactionDate ? toYmd(first.transactionDate) : null;
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const lastEntryYmd = lastEntryQuery.data ?? null;

  const lastDaySummariesQuery = useApiListQuery<unknown>({
    queryKey: salesKeys.entryDay(companyId, lastEntryYmd ?? ''),
    queryFn: () =>
      getDailySalesSummaries(
        companyId,
        lastEntryYmd!,
        lastEntryYmd!,
        1,
        50,
        '',
        'transactionDate',
        'asc',
        false,
      ),
    fallbackMessage: 'فشل تحميل ملخصات اليوم',
    enabled: !!companyId && !!lastEntryYmd,
    staleTime: 15_000,
  });

  const daySummariesQuery = useApiListQuery<unknown>({
    queryKey: salesKeys.entryDay(companyId, txDate),
    queryFn: () =>
      getDailySalesSummaries(
        companyId,
        txDate,
        txDate,
        1,
        50,
        '',
        'transactionDate',
        'asc',
        false,
      ),
    fallbackMessage: 'فشل تحميل ملخصات اليوم',
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
