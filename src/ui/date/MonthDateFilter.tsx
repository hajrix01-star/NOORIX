import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import DateFilterBar from './DateFilterBar';
import { getGregorianMonthNames } from './dateLocale';
import type { DatePeriodState } from './datePeriod';
import { useDateFilter } from './useDateFilter';

export type MonthDateFilterProps = {
  year: number;
  month: number;
  onChange: (value: { year: number; month: number }) => void;
  className?: string;
};

export default function MonthDateFilter({ year, month, onChange, className }: MonthDateFilterProps) {
  const { lang } = useTranslation();
  const filter = useDateFilter();
  const lastSyncedPropKeyRef = useRef('');
  const lastEmittedPropKeyRef = useRef('');
  const monthNames = getGregorianMonthNames(lang);
  const appliedLabel = `${monthNames[month - 1] ?? month} ${year}`;

  useEffect(() => {
    const propKey = `${year}-${month}`;
    if (lastSyncedPropKeyRef.current === propKey) {
      return;
    }
    lastSyncedPropKeyRef.current = propKey;
    filter.setMode('months');
    filter.setSelYear(year);
    filter.setSelMonth(month);
    filter.setMonthRangeStartYear(year);
    filter.setMonthRangeEndYear(year);
    filter.setMonthRangeStartMonth(month);
    filter.setMonthRangeEndMonth(month);
  }, [
    filter.setMode,
    filter.setMonthRangeEndMonth,
    filter.setMonthRangeEndYear,
    filter.setMonthRangeStartMonth,
    filter.setMonthRangeStartYear,
    filter.setSelMonth,
    filter.setSelYear,
    month,
    year,
  ]);

  const handleApply = useCallback((state: DatePeriodState) => {
    if (state.mode !== 'month' && state.mode !== 'months') return;
    const singleMonth =
      state.monthRangeStartYear === state.monthRangeEndYear &&
      state.monthRangeStartMonth === state.monthRangeEndMonth;
    if (!singleMonth) return;
    const next = {
      year: state.monthRangeStartYear,
      month: state.monthRangeStartMonth,
    };
    const nextKey = `${next.year}-${next.month}`;
    const propKey = `${year}-${month}`;
    if (nextKey !== propKey && lastEmittedPropKeyRef.current !== nextKey) {
      lastEmittedPropKeyRef.current = nextKey;
      onChange(next);
    }
  }, [month, onChange, year]);

  return (
    <div className="ndfb-controlled-month-filter">
      <DateFilterBar
        filter={filter}
        modes={['month']}
        showBadge={false}
        onApply={handleApply}
        className={className}
      />
      <span className="ndfb-period-badge ndfb-period-badge--applied" title={appliedLabel}>
        {appliedLabel}
      </span>
    </div>
  );
}
