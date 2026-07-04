import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { getSaudiNow } from '../../utils/saudiDate';
import Button from '../Button';
import { getGregorianMonthNames } from './dateLocale';


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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState(year);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties | null>(null);
  const selectedLabel = `${String(month).padStart(2, '0')}-${year}`;
  const sortedYears = [...years].sort((a, b) => a - b);
  const minYear = sortedYears[0] ?? year;
  const maxYear = sortedYears[sortedYears.length - 1] ?? year;

  useEffect(() => {
    setCalendarYear(year);
  }, [year]);

  const moveYear = (delta: number) => {
    setCalendarYear((current) => Math.min(maxYear, Math.max(minYear, current + delta)));
  };

  useEffect(() => {
    if (!open) return;

    const updatePopoverPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const margin = 14;
      const width = Math.min(360, window.innerWidth - margin * 2);
      const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, margin), window.innerWidth - width - margin);
      const top = Math.min(rect.bottom + 8, window.innerHeight - margin);

      setPopoverStyle({
        position: 'fixed',
        top,
        left,
        width,
      });
    };

    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);

    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectMonth = (nextMonth: number) => {
    onChange({ year: calendarYear, month: nextMonth });
    setOpen(false);
  };

  const popover = open && popoverStyle
    ? createPortal(
      <div
        ref={popoverRef}
        className="ndfb-month-popover ndfb-month-popover--floating"
        role="dialog"
        aria-label={ariaLabel || String(label || t('dateFilterMonth'))}
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
        aria-label={ariaLabel || String(label || t('dateFilterMonth'))}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ndfb-month-picker__icon" aria-hidden />
        <span>{selectedLabel}</span>
        <span className="ndfb-month-picker__chevron" aria-hidden />
      </Button>

      {popover}
    </div>
  );
}
