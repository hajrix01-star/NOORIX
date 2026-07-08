import { useEffect, useMemo } from 'react';
import { DateFilterBar, useDateFilter } from '../../ui/date';
import type { DatePeriodState } from '../../utils/datePeriod';
import type { ReportPeriodMode } from './reportTypes';

type ReportDateFilterProps = {
  onYearChange: (year: number) => void;
  onMonthChange?: (month: string) => void;
  onModeChange?: (mode: ReportPeriodMode) => void;
};

export default function ReportDateFilter({
  onYearChange,
  onMonthChange,
  onModeChange,
}: ReportDateFilterProps) {
  const filter = useDateFilter();
  const period = useMemo(() => deriveReportYearMonth(filter.state), [filter.state]);

  useEffect(() => {
    onYearChange(period.year);
    onMonthChange?.(period.month == null ? '' : String(period.month));
    onModeChange?.(period.month == null ? 'year' : 'month');
  }, [onModeChange, onMonthChange, onYearChange, period.month, period.year]);

  return <DateFilterBar filter={filter} />;
}

export function deriveReportYearMonth(state: DatePeriodState): { year: number; month: number | null } {
  if (state.mode === 'day' && state.selDay) {
    const [year, month] = state.selDay.split('-').map(Number);
    return { year: Number.isInteger(year) ? year : state.selYear, month: normalizeMonth(month) };
  }

  if (state.mode === 'month' || state.mode === 'months') {
    const sameMonth =
      state.monthRangeStartYear === state.monthRangeEndYear &&
      state.monthRangeStartMonth === state.monthRangeEndMonth;
    return {
      year: state.monthRangeStartYear || state.selYear,
      month: sameMonth ? normalizeMonth(state.monthRangeStartMonth) : null,
    };
  }

  return { year: state.selYear, month: null };
}

function normalizeMonth(value: number): number | null {
  return Number.isInteger(value) && value >= 1 && value <= 12 ? value : null;
}
