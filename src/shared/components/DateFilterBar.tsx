import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../hooks/useDateFilter';
import { Button } from '../../ui';
import { getSaudiNow } from '../../utils/saudiDate';
import type { DatePeriodMode } from '../../utils/datePeriod';

export { useDateFilter };

const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function monthOptions() {
  return MONTH_NAMES_EN.map((name, index) => ({ value: index + 1, label: name }));
}

export default function DateFilterBar({ filter }: any) {
  const { t, lang } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const now = getSaudiNow();
  const years = useMemo(() => [now.year + 1, now.year, now.year - 1, now.year - 2, now.year - 3], [now.year]);
  const months = useMemo(() => monthOptions(), []);

  const modes: Array<{ id: DatePeriodMode; label: string }> = [
    { id: 'all', label: t('dateFilterAll') },
    { id: 'day', label: t('dateFilterDay') },
    { id: 'month', label: t('dateFilterMonth') },
    { id: 'months', label: t('dateFilterMonths') },
    { id: 'year', label: t('dateFilterYear') },
    { id: 'range', label: t('dateFilterRange') },
  ];

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const setMode = (mode: DatePeriodMode) => {
    filter.setMode(mode);
  };

  const selectClass = 'ndfb-popover__select';

  return (
    <div ref={rootRef} className="noorix-date-filter-bar" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <button
        type="button"
        className={`ndfb-trigger${open ? ' ndfb-trigger--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="ndfb-trigger__icon" aria-hidden="true">◷</span>
        <span className="ndfb-trigger__text">
          <span className="ndfb-trigger__eyebrow">{t('dateFilterPeriod')}</span>
          <span className="ndfb-trigger__label">{filter.label}</span>
        </span>
        <span className="ndfb-trigger__chevron" aria-hidden="true">▾</span>
      </button>

      <Button type="button" variant="raw" className="ndfb-reset-btn" onClick={filter.reset} title={t('dateFilterReset')}>
        ↺
      </Button>

      {open && (
        <div className="ndfb-popover" role="dialog" aria-label={t('dateFilterPeriod')}>
          <div className="ndfb-popover__modes">
            {modes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`ndfb-mode-btn${filter.mode === mode.id ? ' ndfb-mode-btn--active' : ''}`}
                onClick={() => setMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {filter.mode === 'day' && (
            <div className="ndfb-popover__section">
              <label className="ndfb-popover__field">
                <span>{t('dateFilterDay')}</span>
                <input
                  dir="ltr"
                  type="date"
                  value={filter.selDay}
                  max={ymd(now.year, now.month, now.day)}
                  onChange={(event) => filter.setSelDay(event.target.value)}
                />
              </label>
            </div>
          )}

          {filter.mode === 'month' && (
            <div className="ndfb-popover__section ndfb-popover__grid-2" dir="ltr">
              <label className="ndfb-popover__field">
                <span>{t('dateFilterYear')}</span>
                <select className={selectClass} value={filter.selYear} onChange={(event) => filter.setSelYear(Number(event.target.value))}>
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label className="ndfb-popover__field">
                <span>{t('dateFilterMonth')}</span>
                <select className={selectClass} value={filter.selMonth} onChange={(event) => filter.setSelMonth(Number(event.target.value))}>
                  {months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                </select>
              </label>
            </div>
          )}

          {filter.mode === 'months' && (
            <div className="ndfb-popover__section">
              <div className="ndfb-popover__grid-2" dir="ltr">
                <label className="ndfb-popover__field">
                  <span>{t('dateFilterFrom')}</span>
                  <select className={selectClass} value={filter.monthRangeStartYear} onChange={(event) => filter.setMonthRangeStartYear(Number(event.target.value))}>
                    {years.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </label>
                <label className="ndfb-popover__field">
                  <span>{t('dateFilterMonth')}</span>
                  <select className={selectClass} value={filter.monthRangeStartMonth} onChange={(event) => filter.setMonthRangeStartMonth(Number(event.target.value))}>
                    {months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                  </select>
                </label>
                <label className="ndfb-popover__field">
                  <span>{t('dateFilterTo')}</span>
                  <select className={selectClass} value={filter.monthRangeEndYear} onChange={(event) => filter.setMonthRangeEndYear(Number(event.target.value))}>
                    {years.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </label>
                <label className="ndfb-popover__field">
                  <span>{t('dateFilterMonth')}</span>
                  <select className={selectClass} value={filter.monthRangeEndMonth} onChange={(event) => filter.setMonthRangeEndMonth(Number(event.target.value))}>
                    {months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
          )}

          {filter.mode === 'year' && (
            <div className="ndfb-popover__section ndfb-popover__grid-years">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={`ndfb-year-chip${filter.selYear === year ? ' ndfb-year-chip--active' : ''}`}
                  onClick={() => filter.setSelYear(year)}
                >
                  {year}
                </button>
              ))}
            </div>
          )}

          {filter.mode === 'range' && (
            <div className="ndfb-popover__section ndfb-popover__grid-2">
              <label className="ndfb-popover__field">
                <span>{t('dateFilterFrom')}</span>
                <input dir="ltr" type="date" value={filter.rangeStart} onChange={(event) => filter.setRangeStart(event.target.value)} />
              </label>
              <label className="ndfb-popover__field">
                <span>{t('dateFilterTo')}</span>
                <input dir="ltr" type="date" value={filter.rangeEnd} onChange={(event) => filter.setRangeEnd(event.target.value)} />
              </label>
            </div>
          )}

          <div className="ndfb-popover__footer">
            <span className="ndfb-popover__summary">{filter.label}</span>
            <Button type="button" size="sm" variant="primary" onClick={() => setOpen(false)}>
              {t('dateFilterApply')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
