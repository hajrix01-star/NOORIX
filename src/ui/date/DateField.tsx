import React, { useEffect, useId, useMemo, useState } from 'react';
import Button from '../Button';
import { cn } from '../cn';
import { DatePeriodSelect, type DatePeriodSelectOption } from './DatePeriodControls';
import { getGregorianMonthNames, getGregorianWeekdayNames, type NoorixDateLanguage } from './dateLocale';
import { lastDayOfMonth, ymd } from './datePeriod';
import { useFloatingPopover } from './useFloatingPopover';

const SIZE_FIELD = {
  sm: 'h-7 px-2.5 text-[12px]',
  md: 'h-9 px-3 text-[13px]',
  lg: 'h-11 px-3.5 text-[14px]',
};

const FIELD_BASE = [
  'w-full rounded-lg border border-noorix-border bg-noorix-surface text-noorix-text',
  'focus:outline-none focus:border-noorix-blue focus:ring-1 focus:ring-noorix-blue/30',
  'disabled:opacity-50 disabled:bg-noorix-bg-muted disabled:cursor-not-allowed',
  'transition-colors duration-150',
].join(' ');

export type DateFieldProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'value' | 'onChange' | 'children' | 'style'> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  size?: keyof typeof SIZE_FIELD;
  containerClassName?: string;
  required?: boolean;
  readOnly?: boolean;
  style?: React.CSSProperties | Record<string, string | number | undefined>;
  value?: string;
  onValueChange?: (value: string) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  min?: string;
  max?: string;
  lang?: NoorixDateLanguage | string;
  placeholder?: string;
};

function parseYmd(value: string) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function todayParts() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function yearOptions(min?: string, max?: string, selectedYear?: number): DatePeriodSelectOption[] {
  const current = selectedYear || todayParts().year;
  const minYear = parseYmd(min || '')?.year ?? current - 10;
  const maxYear = parseYmd(max || '')?.year ?? current + 10;
  const start = Math.min(minYear, maxYear);
  const end = Math.max(minYear, maxYear);
  return Array.from({ length: end - start + 1 }, (_, index) => {
    const year = start + index;
    return { value: year, label: year };
  });
}

function monthOptions(monthNames: string[]): DatePeriodSelectOption[] {
  return monthNames.map((name, index) => ({ value: index + 1, label: name }));
}

function isOutOfBounds(date: string, min?: string, max?: string) {
  return (!!min && date < min) || (!!max && date > max);
}

function clampView(year: number, month: number, min?: string, max?: string) {
  const minParts = parseYmd(min || '');
  const maxParts = parseYmd(max || '');
  let nextYear = year;
  let nextMonth = month;
  if (minParts && (nextYear < minParts.year || (nextYear === minParts.year && nextMonth < minParts.month))) {
    nextYear = minParts.year;
    nextMonth = minParts.month;
  }
  if (maxParts && (nextYear > maxParts.year || (nextYear === maxParts.year && nextMonth > maxParts.month))) {
    nextYear = maxParts.year;
    nextMonth = maxParts.month;
  }
  return { year: nextYear, month: nextMonth };
}

export default function DateField({
  value = '',
  onValueChange,
  onChange,
  className = '',
  containerClassName = '',
  label,
  hint,
  error,
  required,
  disabled,
  readOnly,
  size = 'md',
  id: externalId,
  min,
  max,
  name,
  lang = 'ar',
  placeholder = 'YYYY-MM-DD',
  title,
  style,
  ...rest
}: DateFieldProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const parsedValue = parseYmd(value);
  const fallback = parsedValue || parseYmd(min || '') || todayParts();
  const [view, setView] = useState(() => clampView(fallback.year, fallback.month, min, max));
  const calendarYear = view.year;
  const calendarMonth = view.month;
  const safeLang: NoorixDateLanguage = lang === 'en' ? 'en' : 'ar';
  const monthNames = useMemo(() => getGregorianMonthNames(safeLang), [safeLang]);
  const weekdayNames = useMemo(() => getGregorianWeekdayNames(safeLang), [safeLang]);
  const years = useMemo(() => yearOptions(min, max, calendarYear), [calendarYear, max, min]);
  const {
    triggerRef,
    popoverRef,
    open,
    setOpen,
    popoverStyle,
    closePopover,
    togglePopover,
  } = useFloatingPopover({ maxWidth: 390 });

  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const displayValue = value || placeholder;
  const daysCount = lastDayOfMonth(calendarYear, calendarMonth);
  const firstWeekday = new Date(calendarYear, calendarMonth - 1, 1).getDay();
  const today = todayParts();
  const todayValue = ymd(today.year, today.month, today.day);
  const canUseToday = !isOutOfBounds(todayValue, min, max);

  useEffect(() => {
    if (!open) return;
    setView(clampView(fallback.year, fallback.month, min, max));
  }, [fallback.day, fallback.month, fallback.year, max, min, open]);

  const emitValue = (nextValue: string) => {
    onValueChange?.(nextValue);
    if (onChange) {
      onChange({ target: { value: nextValue } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const setCalendarMonth = (year: number, month: number) => {
    setView(clampView(year, month, min, max));
  };

  const shiftCalendarMonth = (delta: number) => {
    const next = new Date(calendarYear, calendarMonth - 1 + delta, 1);
    setCalendarMonth(next.getFullYear(), next.getMonth() + 1);
  };

  const selectDay = (day: number) => {
    const nextValue = ymd(calendarYear, calendarMonth, day);
    if (isOutOfBounds(nextValue, min, max)) return;
    emitValue(nextValue);
    closePopover();
  };

  const selectToday = () => {
    if (!canUseToday) return;
    setView({ year: today.year, month: today.month });
    emitValue(todayValue);
    closePopover();
  };

  const clearValue = () => {
    if (required) return;
    emitValue('');
    closePopover();
  };

  const fieldClassName = cn(
    FIELD_BASE,
    SIZE_FIELD[size as keyof typeof SIZE_FIELD] ?? SIZE_FIELD.md,
    'noorix-date-field justify-between text-start nx-font-numbers',
    !value && 'text-noorix-muted',
    error && 'border-noorix-red focus:ring-noorix-red/30',
    readOnly && 'bg-noorix-bg-muted cursor-default',
    typeof className === 'string' ? className : '',
  );

  return (
    <div className={cn('noorix-date-field-wrap flex flex-col gap-1', containerClassName)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-semibold text-noorix-text">
          {label}
          {required && <span className="text-noorix-red ms-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      {name ? <input type="hidden" name={String(name)} value={value} /> : null}
      <Button
        {...rest}
        ref={triggerRef}
        id={id}
        type="button"
        variant="raw"
        className={fieldClassName}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required || undefined}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        title={typeof title === 'string' ? title : value}
        style={style as React.CSSProperties | undefined}
        onClick={() => {
          if (readOnly) return;
          togglePopover();
        }}
      >
        <span>{displayValue}</span>
        <span className="noorix-date-field__icon" aria-hidden="true">v</span>
      </Button>

      {open && !disabled && !readOnly ? (
        <div
          ref={popoverRef}
          className="noorix-date-picker-popover"
          style={popoverStyle ?? undefined}
          role="dialog"
          aria-label={typeof label === 'string' ? label : 'Date picker'}
        >
          <div className="ndfb-calendar-panel">
            <div className="ndfb-calendar-panel__head">
              <span>{safeLang === 'en' ? 'Date' : 'التاريخ'}</span>
              <div className="ndfb-calendar-head-controls">
                <Button
                  variant="raw"
                  type="button"
                  className="noorix-date-picker-nav-button"
                  aria-label={safeLang === 'en' ? 'Previous month' : 'الشهر السابق'}
                  onClick={() => shiftCalendarMonth(-1)}
                >
                  {'<'}
                </Button>
                <DatePeriodSelect
                  label={safeLang === 'en' ? 'Year' : 'السنة'}
                  className="ndfb-calendar-year-select"
                  value={calendarYear}
                  options={years}
                  onValueChange={(nextYear) => setCalendarMonth(Number(nextYear), calendarMonth)}
                />
                <DatePeriodSelect
                  label={safeLang === 'en' ? 'Month' : 'الشهر'}
                  className="ndfb-calendar-month-select"
                  value={calendarMonth}
                  options={monthOptions(monthNames)}
                  onValueChange={(nextMonth) => setCalendarMonth(calendarYear, Number(nextMonth))}
                />
                <Button
                  variant="raw"
                  type="button"
                  className="noorix-date-picker-nav-button"
                  aria-label={safeLang === 'en' ? 'Next month' : 'الشهر التالي'}
                  onClick={() => shiftCalendarMonth(1)}
                >
                  {'>'}
                </Button>
              </div>
            </div>
            <div className="ndfb-weekday-grid" aria-hidden="true">
              {weekdayNames.map((name) => <span key={name}>{name}</span>)}
            </div>
            <div className="ndfb-day-grid">
              {Array.from({ length: firstWeekday }).map((_, index) => (
                <span key={`blank-${index}`} className="ndfb-day-cell ndfb-day-cell--blank" />
              ))}
              {Array.from({ length: daysCount }).map((_, index) => {
                const day = index + 1;
                const date = ymd(calendarYear, calendarMonth, day);
                const active = date === value;
                const blocked = isOutOfBounds(date, min, max);
                return (
                  <Button
                    variant="raw"
                    key={date}
                    type="button"
                    disabled={blocked}
                    className={`ndfb-day-cell${active ? ' ndfb-day-cell--active' : ''}${blocked ? ' noorix-date-picker-day--disabled' : ''}`}
                    aria-label={date}
                    onClick={() => selectDay(day)}
                  >
                    {day}
                  </Button>
                );
              })}
            </div>
            <div className="noorix-date-picker-actions">
              <Button
                variant="raw"
                type="button"
                className="noorix-date-picker-action"
                disabled={!canUseToday}
                onClick={selectToday}
              >
                {safeLang === 'en' ? 'Today' : 'اليوم'}
              </Button>
              {!required ? (
                <Button
                  variant="raw"
                  type="button"
                  className="noorix-date-picker-action"
                  onClick={clearValue}
                >
                  {safeLang === 'en' ? 'Clear' : 'مسح'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {hint && !error && (
        <p id={`${id}-hint`} className="text-[12px] text-noorix-muted">{hint}</p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-noorix-red font-medium">{error}</p>
      )}
    </div>
  );
}
