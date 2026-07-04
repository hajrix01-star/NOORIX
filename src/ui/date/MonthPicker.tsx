import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { getSaudiNow } from '../../utils/saudiDate';
import Button from '../Button';
import { getGregorianMonthNames } from './dateLocale';
import { useFloatingPopover } from './useFloatingPopover';

export type DateFilterMonthPickerProps = {
  label?: React.ReactNode;
  ariaLabel?: string;
  year: number;
  month: number;
  years?: number[];
  onChange: (value: { year: number; month: number }) => void;
  className?: string;
};

export default function DateFilterMonthPicker({
  label,
  ariaLabel,
  year,
  month,
  years: yearsProp,
  onChange,
  className = '',
}: DateFilterMonthPickerProps) {
  const { t, lang } = useTranslation();
  const now = getSaudiNow();
  const years = yearsProp?.length
    ? yearsProp
    : [now.year + 1, now.year, now.year - 1, now.year - 2, now.year - 3];
  const monthNames = getGregorianMonthNames(lang);
  const {
    triggerRef,
    popoverRef,
    open,
    popoverStyle,
    closePopover,
    togglePopover,
  } = useFloatingPopover();
  const [calendarYear, setCalendarYear] = useState(year);
  const selectedLabel = `${String(month).padStart(2, '0')}-${year}`;
  const sortedYears = [...years].sort((a, b) => a - b);
  const minYear = sortedYears[0] ?? year;
  const maxYear = sortedYears[sortedYears.length - 1] ?? year;
  const pickerLabel = ariaLabel || String(label || t('dateFilterMonth'));

  useEffect(() => {
    setCalendarYear(year);
  }, [year]);

  const moveYear = (delta: number) => {
    setCalendarYear((current) => Math.min(maxYear, Math.max(minYear, current + delta)));
  };

  const selectMonth = (nextMonth: number) => {
    onChange({ year: calendarYear, month: nextMonth });
    closePopover();
  };

  const popover = open && popoverStyle
    ? createPortal(
      <div
        ref={popoverRef}
        className="ndfb-month-popover ndfb-month-popover--floating"
        role="dialog"
        aria-label={pickerLabel}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        style={popoverStyle}
      >
        <div className="ndfb-month-popover__tabs" role="tablist" aria-label={t('dateFilterPeriod')}>
          <Button variant="raw" type="button" className="ndfb-month-popover__tab ndfb-month-popover__tab--active" role="tab" aria-selected="true">
            {t('dateFilterMonth')}
          </Button>
        </div>

        <div className="ndfb-month-popover__year">
          <Button
            variant="raw"
            type="button"
            className="ndfb-month-popover__year-btn"
            onClick={() => moveYear(-1)}
            disabled={calendarYear <= minYear}
            aria-label={`${t('dateFilterYear')} -1`}
          >
            {'<'}
          </Button>
          <div className="ndfb-month-popover__year-value">{calendarYear}</div>
          <Button
            variant="raw"
            type="button"
            className="ndfb-month-popover__year-btn"
            onClick={() => moveYear(1)}
            disabled={calendarYear >= maxYear}
            aria-label={`${t('dateFilterYear')} +1`}
          >
            {'>'}
          </Button>
        </div>

        <div className="ndfb-month-popover__grid">
          {monthNames.map((name, index) => {
            const itemMonth = index + 1;
            const active = calendarYear === year && itemMonth === month;
            return (
              <Button
                variant="raw"
                key={itemMonth}
                type="button"
                className={`ndfb-month-popover__cell${active ? ' ndfb-month-popover__cell--active' : ''}`}
                aria-label={name}
                aria-pressed={active}
                onClick={() => selectMonth(itemMonth)}
              >
                {String(itemMonth).padStart(2, '0')}
              </Button>
            );
          })}
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div className={`noorix-date-filter-bar ndfb-month-picker ${className}`.trim()} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {label && <span className="ndfb-month-picker__label">{label}</span>}
      <Button
        variant="raw"
        ref={triggerRef}
        type="button"
        className={`ndfb-period-badge ndfb-month-picker__trigger${open ? ' ndfb-period-badge--pending' : ''}`}
        aria-label={pickerLabel}
        aria-expanded={open}
        onClick={togglePopover}
      >
        <span className="ndfb-month-picker__icon" aria-hidden />
        <span>{selectedLabel}</span>
        <span className="ndfb-month-picker__chevron" aria-hidden />
      </Button>

      {popover}
    </div>
  );
}
