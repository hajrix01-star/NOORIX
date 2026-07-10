import { useCallback, useMemo, useState } from 'react';
import { getSaudiNow } from '../../utils/saudiDate';
import {
  buildDatePeriodLabel,
  resolveDatePeriodRange,
  ymd,
  type DatePeriodMode,
  type DatePeriodState,
} from './datePeriod';

export function useDateFilter(initialMode: DatePeriodMode = 'months') {
  const now = getSaudiNow();

  const [mode, setMode] = useState<DatePeriodMode>(initialMode);
  const [selYear, setSelYear] = useState(now.year);
  const [selMonth, setSelMonth] = useState(now.month);
  const [selQuarter, setSelQuarter] = useState(Math.ceil(now.month / 3));
  const [selDay, setSelDay] = useState(ymd(now.year, now.month, now.day));
  const [rangeStart, setRangeStart] = useState(ymd(now.year, now.month, 1));
  const [rangeEnd, setRangeEnd] = useState(ymd(now.year, now.month, now.day));
  const [monthRangeStartYear, setMonthRangeStartYear] = useState(now.year);
  const [monthRangeStartMonth, setMonthRangeStartMonth] = useState(now.month);
  const [monthRangeEndYear, setMonthRangeEndYear] = useState(now.year);
  const [monthRangeEndMonth, setMonthRangeEndMonth] = useState(now.month);
  const [yearRangeStart, setYearRangeStart] = useState(now.year);
  const [yearRangeEnd, setYearRangeEnd] = useState(now.year);

  const state: DatePeriodState = useMemo(
    () => ({
      mode,
      selYear,
      selMonth,
      selQuarter,
      selDay,
      rangeStart,
      rangeEnd,
      monthRangeStartYear,
      monthRangeStartMonth,
      monthRangeEndYear,
      monthRangeEndMonth,
      yearRangeStart,
      yearRangeEnd,
    }),
    [
      mode,
      selYear,
      selMonth,
      selQuarter,
      selDay,
      rangeStart,
      rangeEnd,
      monthRangeStartYear,
      monthRangeStartMonth,
      monthRangeEndYear,
      monthRangeEndMonth,
      yearRangeStart,
      yearRangeEnd,
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
    setMode(initialMode);
    setSelYear(n.year);
    setSelMonth(n.month);
    setSelQuarter(Math.ceil(n.month / 3));
    setSelDay(ymd(n.year, n.month, n.day));
    setRangeStart(ymd(n.year, n.month, 1));
    setRangeEnd(ymd(n.year, n.month, n.day));
    setMonthRangeStartYear(n.year);
    setMonthRangeStartMonth(n.month);
    setMonthRangeEndYear(n.year);
    setMonthRangeEndMonth(n.month);
    setYearRangeStart(n.year);
    setYearRangeEnd(n.year);
  }, [initialMode]);

  return useMemo(
    () => ({
      mode,
      setMode,
      selYear,
      setSelYear,
      selMonth,
      setSelMonth,
      selQuarter,
      setSelQuarter,
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
      yearRangeStart,
      setYearRangeStart,
      yearRangeEnd,
      setYearRangeEnd,
      startDate,
      endDate,
      label,
      reset,
      state,
    }),
    [
      mode,
      selYear,
      selMonth,
      selQuarter,
      selDay,
      rangeStart,
      rangeEnd,
      monthRangeStartYear,
      monthRangeStartMonth,
      monthRangeEndYear,
      monthRangeEndMonth,
      yearRangeStart,
      yearRangeEnd,
      startDate,
      endDate,
      label,
      reset,
      state,
    ],
  );
}

export type DateFilterController = ReturnType<typeof useDateFilter>;
