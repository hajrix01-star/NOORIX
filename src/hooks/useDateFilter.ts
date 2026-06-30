import { useCallback, useMemo, useState } from 'react';
import { getSaudiNow } from '../utils/saudiDate';
import {
  buildDatePeriodLabel,
  resolveDatePeriodRange,
  ymd,
  type DatePeriodMode,
  type DatePeriodState,
} from '../utils/datePeriod';

export function useDateFilter() {
  const now = getSaudiNow();

  const [mode, setMode] = useState<DatePeriodMode>('month');
  const [selYear, setSelYear] = useState(now.year);
  const [selMonth, setSelMonth] = useState(now.month);
  const [selDay, setSelDay] = useState(ymd(now.year, now.month, now.day));
  const [rangeStart, setRangeStart] = useState(ymd(now.year, now.month, 1));
  const [rangeEnd, setRangeEnd] = useState(ymd(now.year, now.month, now.day));
  const [monthRangeStartYear, setMonthRangeStartYear] = useState(now.year);
  const [monthRangeStartMonth, setMonthRangeStartMonth] = useState(Math.max(1, now.month - 2));
  const [monthRangeEndYear, setMonthRangeEndYear] = useState(now.year);
  const [monthRangeEndMonth, setMonthRangeEndMonth] = useState(now.month);

  const state: DatePeriodState = useMemo(
    () => ({
      mode,
      selYear,
      selMonth,
      selDay,
      rangeStart,
      rangeEnd,
      monthRangeStartYear,
      monthRangeStartMonth,
      monthRangeEndYear,
      monthRangeEndMonth,
    }),
    [
      mode,
      selYear,
      selMonth,
      selDay,
      rangeStart,
      rangeEnd,
      monthRangeStartYear,
      monthRangeStartMonth,
      monthRangeEndYear,
      monthRangeEndMonth,
    ],
  );

  const { startDate, endDate } = useMemo(
    () => resolveDatePeriodRange(state, now),
    [state, now.year, now.month, now.day],
  );

  const label = useMemo(
    () => buildDatePeriodLabel(state, now),
    [state, now.year, now.month, now.day],
  );

  const reset = useCallback(() => {
    const n = getSaudiNow();
    setMode('month');
    setSelYear(n.year);
    setSelMonth(n.month);
    setSelDay(ymd(n.year, n.month, n.day));
    setRangeStart(ymd(n.year, n.month, 1));
    setRangeEnd(ymd(n.year, n.month, n.day));
    setMonthRangeStartYear(n.year);
    setMonthRangeStartMonth(Math.max(1, n.month - 2));
    setMonthRangeEndYear(n.year);
    setMonthRangeEndMonth(n.month);
  }, []);

  return {
    mode,
    setMode,
    selYear,
    setSelYear,
    selMonth,
    setSelMonth,
    selDay,
    setSelDay,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    monthRangeStartYear,
    setMonthRangeStartYear,
    monthRangeStartMonth,
    setMonthRangeStartMonth,
    monthRangeEndYear,
    setMonthRangeEndYear,
    monthRangeEndMonth,
    setMonthRangeEndMonth,
    startDate,
    endDate,
    label,
    reset,
    state,
  };
}
