import React, { useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { getSaudiNow } from '../../utils/saudiDate';
import { cn } from '../cn';
import type { DatePeriodMode } from './datePeriod';
import DateFilterMonthPicker from './MonthPicker';
import { DatePeriodModeGroup, DatePeriodSelect, type DatePeriodModeOption } from './DatePeriodControls';

export type DateMonthScopeMode = Extract<DatePeriodMode, 'all' | 'year' | 'month'>;

export type DateMonthScopePickerProps = {
  year: number;
  years?: number[];
  month?: string | number | null;
  mode?: DateMonthScopeMode;
  allowAll?: boolean;
  allowYear?: boolean;
  allowMonth?: boolean;
  className?: string;
  monthPickerClassName?: string;
  yearLabel?: string;
  monthLabel?: string;
  allLabel?: string;
  fallbackMonth?: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: string) => void;
  onModeChange?: (mode: DateMonthScopeMode) => void;
};

export default function DateMonthScopePicker({
  year,
  years: yearsProp,
  month,
  mode,
  allowAll = false,
  allowYear = true,
  allowMonth = true,
  className = '',
  monthPickerClassName = '',
  yearLabel,
  monthLabel,
  allLabel,
  fallbackMonth,
  onYearChange,
  onMonthChange,
  onModeChange,
}: DateMonthScopePickerProps) {
  const { t, lang } = useTranslation();
  const now = getSaudiNow();
  const years = yearsProp?.length
    ? yearsProp
    : [now.year + 1, now.year, now.year - 1, now.year - 2, now.year - 3];
  const monthNumber = normalizeMonth(month);
  const requestedMode = mode ?? (allowAll && !monthNumber ? 'all' : allowMonth ? 'month' : 'year');
  const effectiveMode: DateMonthScopeMode =
    requestedMode === 'month' && !allowMonth ? 'year' :
    requestedMode === 'year' && !allowYear ? (allowMonth ? 'month' : 'all') :
    requestedMode === 'all' && !allowAll ? (allowMonth ? 'month' : 'year') :
    requestedMode;
  const safeFallbackMonth = normalizeMonth(fallbackMonth) || now.month;
  const resolvedYearLabel = yearLabel || t('reportYear');
  const resolvedMonthLabel = monthLabel || t('reportMonth');
  const resolvedAllLabel = allLabel || t('allMonths');

  const modeOptions = useMemo<DatePeriodModeOption[]>(() => {
    const options: DatePeriodModeOption[] = [];
    if (allowAll) options.push({ id: 'all', label: resolvedAllLabel });
    if (allowYear) options.push({ id: 'year', label: t('dateFilterYear') });
    if (allowMonth) options.push({ id: 'month', label: t('dateFilterMonth') });
    return options;
  }, [allowAll, allowMonth, allowYear, resolvedAllLabel, t]);

  const handleModeChange = (nextMode: DatePeriodMode) => {
    const next = nextMode as DateMonthScopeMode;
    onModeChange?.(next);
    if (next === 'all') onMonthChange('');
    if (next === 'month' && !monthNumber) onMonthChange(String(safeFallbackMonth));
  };

  const handleMonthChange = (value: { year: number; month: number }) => {
    if (value.year !== year) onYearChange(value.year);
    onMonthChange(String(value.month));
    onModeChange?.('month');
  };

  return (
    <div className={cn('noorix-date-filter-bar ndfb-scope-picker', className)} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <DatePeriodModeGroup
        mode={effectiveMode}
        options={modeOptions}
        ariaLabel={t('dateFilterPeriod')}
        onModeChange={handleModeChange}
      />

      <DatePeriodSelect
        label={resolvedYearLabel}
        value={year}
        className="ndfb-calendar-year-select"
        options={years.map((item) => ({ value: item, label: item }))}
        onValueChange={(value) => onYearChange(Number(value))}
      />

      {effectiveMode === 'month' && (
        <DateFilterMonthPicker
          label={resolvedMonthLabel}
          ariaLabel={resolvedMonthLabel}
          year={year}
          month={monthNumber || safeFallbackMonth}
          years={years}
          onChange={handleMonthChange}
          className={cn('ndfb-scope-picker__month', monthPickerClassName)}
        />
      )}

      {effectiveMode === 'all' && <span className="ndfb-period-badge">{resolvedAllLabel}</span>}
      {effectiveMode === 'year' && <span className="ndfb-period-badge">{year}</span>}
    </div>
  );
}

function normalizeMonth(value: string | number | null | undefined): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  return n;
}
