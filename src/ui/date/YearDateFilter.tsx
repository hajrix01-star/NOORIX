import { useEffect, useRef } from 'react';
import DateFilterBar from './DateFilterBar';
import { useDateFilter } from './useDateFilter';

export type YearDateFilterProps = {
  year: number;
  onYearChange: (year: number) => void;
  className?: string;
};

export default function YearDateFilter({ year, onYearChange, className }: YearDateFilterProps) {
  const filter = useDateFilter();
  const state = filter.state;
  const lastSyncedYearRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastSyncedYearRef.current === year) {
      return;
    }
    lastSyncedYearRef.current = year;
    filter.setMode('year');
    filter.setSelYear(year);
    filter.setYearRangeStart(year);
    filter.setYearRangeEnd(year);
  }, [
    filter.setMode,
    filter.setSelYear,
    filter.setYearRangeEnd,
    filter.setYearRangeStart,
    year,
  ]);

  useEffect(() => {
    if (state.mode !== 'year') return;
    const nextYear = state.yearRangeEnd || state.yearRangeStart || state.selYear;
    if (Number.isInteger(nextYear) && nextYear !== year) {
      onYearChange(nextYear);
    }
  }, [onYearChange, state.mode, state.selYear, state.yearRangeEnd, state.yearRangeStart, year]);

  return <DateFilterBar filter={filter} modes={['year']} className={className} />;
}
