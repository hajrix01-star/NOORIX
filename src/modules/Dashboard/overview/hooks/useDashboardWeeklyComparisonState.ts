import { useEffect, useMemo, useState } from 'react';
import { getSaudiYearMonth } from '../../../../utils/saudiDate';
import { buildDashboardMonthOptions } from '../utils/dashboardOverviewPresentationModel';
import { lastDayOfMonth, prevCalendarMonth, ymd } from '../utils/dashboardOverviewDateUtils';

type DashboardWeeklyComparisonStateParams = {
  year: number;
  selectedMonth: number | null;
  lang: string;
};

export function useDashboardWeeklyComparisonState({
  year,
  selectedMonth,
  lang,
}: DashboardWeeklyComparisonStateParams) {
  const saInit = getSaudiYearMonth();
  const initPrev = prevCalendarMonth(saInit.year, saInit.month);
  const [yearA, setYearA] = useState(saInit.year);
  const [monthA, setMonthA] = useState(saInit.month);
  const [yearB, setYearB] = useState(initPrev.year);
  const [monthB, setMonthB] = useState(initPrev.month);

  useEffect(() => {
    if (selectedMonth == null) return;
    setYearA(year);
    setMonthA(selectedMonth);
    const previous = prevCalendarMonth(year, selectedMonth);
    setYearB(previous.year);
    setMonthB(previous.month);
  }, [year, selectedMonth]);

  const yearOptions = useMemo(() => {
    const sa = getSaudiYearMonth();
    const high = sa.year + 1;
    const low = high - 10;
    return Array.from({ length: high - low + 1 }, (_, index) => high - index);
  }, []);

  const monthOptions = useMemo(
    () => buildDashboardMonthOptions(lang),
    [lang],
  );

  const boundsA = useMemo(() => {
    const lastDay = lastDayOfMonth(yearA, monthA);
    return { start: ymd(yearA, monthA, 1), end: ymd(yearA, monthA, lastDay) };
  }, [yearA, monthA]);

  const boundsB = useMemo(() => {
    const lastDay = lastDayOfMonth(yearB, monthB);
    return { start: ymd(yearB, monthB, 1), end: ymd(yearB, monthB, lastDay) };
  }, [yearB, monthB]);

  const yearSpanA = useMemo(
    () => ({ yearStart: `${yearA}-01-01`, yearEnd: `${yearA}-12-31` }),
    [yearA],
  );

  return {
    yearA,
    setYearA,
    monthA,
    setMonthA,
    yearB,
    setYearB,
    monthB,
    setMonthB,
    yearOptions,
    monthOptions,
    boundsA,
    boundsB,
    yearSpanA,
  };
}
