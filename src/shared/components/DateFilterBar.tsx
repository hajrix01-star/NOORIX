import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../hooks/useDateFilter';
import { Button, Input } from '../../ui';
import { getSaudiNow } from '../../utils/saudiDate';
import {
  buildDatePeriodLabel,
  lastDayOfMonth,
  normalizeDateSpan,
  normalizeYearSpan,
  ymd,
  type DatePeriodMode,
  type DatePeriodState,
} from '../../utils/datePeriod';

export { useDateFilter };

const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const WEEKDAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function normalizeMode(mode: DatePeriodMode): DatePeriodMode {
  return mode === 'month' ? 'months' : mode;
}

function toUiMode(mode: DatePeriodMode): DatePeriodMode {
  return mode === 'months' ? 'month' : mode;
}

function cloneDateState(state: DatePeriodState): DatePeriodState {
  return {
    ...state,
    mode: normalizeMode(state.mode),
    yearRangeStart: state.yearRangeStart || state.selYear,
    yearRangeEnd: state.yearRangeEnd || state.selYear,
  };
}

function useDraftDateState(filter: any) {
  const [draft, setDraft] = useState<DatePeriodState>(() => cloneDateState(filter.state));

  useEffect(() => {
    setDraft(cloneDateState(filter.state));
  }, [filter.state]);

  const updateDraft = (patch: Partial<DatePeriodState>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  return { draft, updateDraft, setDraft };
}

function applyDraft(filter: any, draft: DatePeriodState) {
  filter.setMode(normalizeMode(draft.mode));
  filter.setSelYear(draft.selYear);
  filter.setSelMonth(draft.selMonth);
  filter.setSelDay(draft.selDay);
  filter.setRangeStart(draft.rangeStart);
  filter.setRangeEnd(draft.rangeEnd);
  filter.setMonthRangeStartYear(draft.monthRangeStartYear);
  filter.setMonthRangeStartMonth(draft.monthRangeStartMonth);
  filter.setMonthRangeEndYear(draft.monthRangeEndYear);
  filter.setMonthRangeEndMonth(draft.monthRangeEndMonth);
  filter.setYearRangeStart?.(draft.yearRangeStart || draft.selYear);
  filter.setYearRangeEnd?.(draft.yearRangeEnd || draft.selYear);
}

type MonthCalendarProps = {
  draft: DatePeriodState;
  monthNames: string[];
  years: number[];
  updateDraft: (patch: Partial<DatePeriodState>) => void;
  yearLabel: string;
};

function monthIndex(year: number, month: number) {
  return year * 12 + month;
}

function parseYmd(value: string) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  return { year: year || 0, month: month || 0, day: day || 0 };
}

function isMonthInDraftRange(draft: DatePeriodState, year: number, month: number) {
  const start = monthIndex(draft.monthRangeStartYear, draft.monthRangeStartMonth);
  const end = monthIndex(draft.monthRangeEndYear, draft.monthRangeEndMonth);
  const value = monthIndex(year, month);
  return value >= Math.min(start, end) && value <= Math.max(start, end);
}

function MonthCalendar({ draft, monthNames, years, updateDraft, yearLabel }: MonthCalendarProps) {
  const [anchor, setAnchor] = useState<{ year: number; month: number } | null>(null);
  const calendarYear = draft.monthRangeStartYear || draft.selYear;
  const hasRange = (
    draft.monthRangeStartYear !== draft.monthRangeEndYear
    || draft.monthRangeStartMonth !== draft.monthRangeEndMonth
  );

  const selectYear = (year: number) => {
    updateDraft({
      monthRangeStartYear: year,
      monthRangeEndYear: year,
    });
    setAnchor(null);
  };

  const selectMonth = (month: number) => {
    if (!anchor || hasRange || draft.monthRangeStartYear !== calendarYear || draft.monthRangeEndYear !== calendarYear) {
      updateDraft({
        monthRangeStartYear: calendarYear,
        monthRangeStartMonth: month,
        monthRangeEndYear: calendarYear,
        monthRangeEndMonth: month,
      });
      setAnchor({ year: calendarYear, month });
      return;
    }

    updateDraft({
      monthRangeStartYear: anchor.year,
      monthRangeStartMonth: anchor.month,
      monthRangeEndYear: calendarYear,
      monthRangeEndMonth: month,
    });
    setAnchor(null);
  };

  return (
    <div className="ndfb-calendar ndfb-calendar--months">
      <div className="ndfb-calendar-panel">
        <div className="ndfb-calendar-panel__head">
          <span>{yearLabel}</span>
          <select
            className="ndfb-calendar-year-select"
            value={calendarYear}
            onChange={(event) => selectYear(Number(event.target.value))}
            aria-label={yearLabel}
          >
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div className="ndfb-month-grid">
          {monthNames.map((name, index) => {
            const month = index + 1;
            const active = isMonthInDraftRange(draft, calendarYear, month);
            return (
              <button
                key={month}
                type="button"
                className={`ndfb-month-cell${active ? ' ndfb-month-cell--active' : ''}`}
                aria-label={name}
                onClick={() => selectMonth(month)}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export type DateFilterMonthPickerProps = {
  label?: React.ReactNode;
  ariaLabel?: string;
  year: number;
  month: number;
  years?: number[];
  onChange: (value: { year: number; month: number }) => void;
  className?: string;
};

export function DateFilterMonthPicker({
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
  const monthNames = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
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
          <button type="button" className="ndfb-month-popover__tab ndfb-month-popover__tab--active" role="tab" aria-selected="true">
            {t('dateFilterMonth')}
          </button>
        </div>

        <div className="ndfb-month-popover__year">
          <button
            type="button"
            className="ndfb-month-popover__year-btn"
            onClick={() => moveYear(-1)}
            disabled={calendarYear <= minYear}
            aria-label={`${t('dateFilterYear')} -1`}
          >
            {'<'}
          </button>
          <div className="ndfb-month-popover__year-value">{calendarYear}</div>
          <button
            type="button"
            className="ndfb-month-popover__year-btn"
            onClick={() => moveYear(1)}
            disabled={calendarYear >= maxYear}
            aria-label={`${t('dateFilterYear')} +1`}
          >
            {'>'}
          </button>
        </div>

        <div className="ndfb-month-popover__grid">
          {monthNames.map((name, index) => {
            const itemMonth = index + 1;
            const active = calendarYear === year && itemMonth === month;
            return (
              <button
                key={itemMonth}
                type="button"
                className={`ndfb-month-popover__cell${active ? ' ndfb-month-popover__cell--active' : ''}`}
                aria-label={name}
                aria-pressed={active}
                onClick={() => selectMonth(itemMonth)}
              >
                {String(itemMonth).padStart(2, '0')}
              </button>
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
      <button
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
      </button>

      {popover}
    </div>
  );
}

type YearCalendarProps = {
  draft: DatePeriodState;
  years: number[];
  updateDraft: (patch: Partial<DatePeriodState>) => void;
  yearLabel: string;
};

function isYearInDraftRange(draft: DatePeriodState, year: number) {
  const span = normalizeYearSpan(draft.yearRangeStart || draft.selYear, draft.yearRangeEnd || draft.selYear);
  return year >= span.startYear && year <= span.endYear;
}

function YearCalendar({ draft, years, updateDraft, yearLabel }: YearCalendarProps) {
  const [anchor, setAnchor] = useState<number | null>(null);
  const span = normalizeYearSpan(draft.yearRangeStart || draft.selYear, draft.yearRangeEnd || draft.selYear);
  const hasRange = span.startYear !== span.endYear;

  const selectYear = (year: number) => {
    if (anchor === null || hasRange) {
      updateDraft({ selYear: year, yearRangeStart: year, yearRangeEnd: year });
      setAnchor(year);
      return;
    }
    const next = normalizeYearSpan(anchor, year);
    updateDraft({ selYear: next.startYear, yearRangeStart: next.startYear, yearRangeEnd: next.endYear });
    setAnchor(null);
  };

  return (
    <div className="ndfb-calendar ndfb-calendar--years">
      <div className="ndfb-calendar-panel">
        <div className="ndfb-calendar-panel__head">
          <span>{yearLabel}</span>
          <span className="ndfb-calendar-panel__hint">{span.startYear === span.endYear ? span.startYear : `${span.startYear} - ${span.endYear}`}</span>
        </div>
        <div className="ndfb-year-grid">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              className={`ndfb-year-cell${isYearInDraftRange(draft, year) ? ' ndfb-year-cell--active' : ''}`}
              aria-label={String(year)}
              onClick={() => selectYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type DayCalendarProps = {
  draft: DatePeriodState;
  monthNames: string[];
  weekdayNames: string[];
  years: number[];
  updateDraft: (patch: Partial<DatePeriodState>) => void;
  yearLabel: string;
  monthLabel: string;
};

function isDayInDraftRange(draft: DatePeriodState, date: string) {
  const span = normalizeDateSpan(draft.rangeStart || draft.selDay, draft.rangeEnd || draft.selDay);
  return !!span.startDate && !!span.endDate && date >= span.startDate && date <= span.endDate;
}

function DayCalendar({ draft, monthNames, weekdayNames, years, updateDraft, yearLabel, monthLabel }: DayCalendarProps) {
  const [anchor, setAnchor] = useState<string | null>(null);
  const parsed = parseYmd(draft.rangeStart || draft.selDay);
  const calendarYear = parsed.year || years[1] || years[0];
  const calendarMonth = parsed.month || 1;
  const daysCount = lastDayOfMonth(calendarYear, calendarMonth);
  const firstWeekday = new Date(calendarYear, calendarMonth - 1, 1).getDay();
  const span = normalizeDateSpan(draft.rangeStart || draft.selDay, draft.rangeEnd || draft.selDay);
  const hasRange = span.startDate !== span.endDate;

  const setCalendarMonth = (year: number, month: number) => {
    const boundedDay = Math.min(parsed.day || 1, lastDayOfMonth(year, month));
    const date = ymd(year, month, boundedDay);
    updateDraft({
      selDay: date,
      rangeStart: date,
      rangeEnd: date,
    });
    setAnchor(null);
  };

  const selectDay = (day: number) => {
    const date = ymd(calendarYear, calendarMonth, day);
    if (!anchor || hasRange) {
      updateDraft({ selDay: date, rangeStart: date, rangeEnd: date });
      setAnchor(date);
      return;
    }
    const next = normalizeDateSpan(anchor, date);
    updateDraft({ selDay: next.startDate, rangeStart: next.startDate, rangeEnd: next.endDate });
    setAnchor(null);
  };

  return (
    <div className="ndfb-calendar ndfb-calendar--days">
      <div className="ndfb-calendar-panel">
        <div className="ndfb-calendar-panel__head">
          <span>{monthLabel}</span>
          <div className="ndfb-calendar-head-controls">
            <select
              className="ndfb-calendar-year-select"
              value={calendarYear}
              onChange={(event) => setCalendarMonth(Number(event.target.value), calendarMonth)}
              aria-label={yearLabel}
            >
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <select
              className="ndfb-calendar-month-select"
              value={calendarMonth}
              onChange={(event) => setCalendarMonth(calendarYear, Number(event.target.value))}
              aria-label={monthLabel}
            >
              {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
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
            const active = isDayInDraftRange(draft, date);
            return (
              <button
                key={date}
                type="button"
                className={`ndfb-day-cell${active ? ' ndfb-day-cell--active' : ''}`}
                aria-label={date}
                onClick={() => selectDay(day)}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DateFilterBar({ filter }: any) {
  const { t, lang } = useTranslation();
  const now = getSaudiNow();
  const years = useMemo(() => [now.year + 1, now.year, now.year - 1, now.year - 2, now.year - 3], [now.year]);
  const monthNames = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
  const weekdayNames = lang === 'ar' ? WEEKDAY_NAMES_AR : WEEKDAY_NAMES_EN;
  const { draft, updateDraft } = useDraftDateState(filter);
  const [openPanel, setOpenPanel] = useState<DatePeriodMode | null>(null);
  const mode = toUiMode(draft.mode);
  const draftLabel = buildDatePeriodLabel(draft, now);
  const isDirty = JSON.stringify(cloneDateState(filter.state)) !== JSON.stringify(draft);

  const setMode = (nextMode: DatePeriodMode) => {
    const normalized = normalizeMode(nextMode);
    if (normalized === 'day') {
      const day = draft.selDay || ymd(now.year, now.month, now.day);
      updateDraft({ mode: normalized, rangeStart: day, rangeEnd: day });
      setOpenPanel('day');
      return;
    }
    if (normalized === 'year') {
      const year = draft.yearRangeStart || draft.selYear || now.year;
      updateDraft({ mode: normalized, selYear: year, yearRangeStart: year, yearRangeEnd: draft.yearRangeEnd || year });
      setOpenPanel('year');
      return;
    }
    updateDraft({ mode: normalized });
    setOpenPanel(nextMode === 'all' ? null : nextMode);
  };

  const apply = () => {
    applyDraft(filter, draft);
    setOpenPanel(null);
  };

  const reset = () => {
    filter.reset();
    setOpenPanel(null);
  };

  return (
    <div className="noorix-date-filter-bar" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="ndfb-mode-group" role="group" aria-label={t('dateFilterPeriod')}>
        {[
          { id: 'all', label: t('dateFilterAll') },
          { id: 'month', label: t('dateFilterMonth') },
          { id: 'year', label: t('dateFilterYear') },
          { id: 'day', label: t('dateFilterDay') },
          { id: 'range', label: t('dateFilterRange') },
        ].map((item) => (
          <Button
            key={item.id}
            type="button"
            size="auto"
            variant="raw"
            className={`ndfb-mode-btn${mode === item.id ? ' ndfb-mode-btn--active' : ''}`}
            aria-pressed={mode === item.id}
            onClick={() => setMode(item.id as DatePeriodMode)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {mode === 'month' && openPanel === 'month' && (
        <MonthCalendar
          draft={draft}
          monthNames={monthNames}
          years={years}
          updateDraft={updateDraft}
          yearLabel={t('dateFilterYear')}
        />
      )}

      {mode === 'year' && openPanel === 'year' && (
        <YearCalendar
          draft={draft}
          years={years}
          updateDraft={updateDraft}
          yearLabel={t('dateFilterYear')}
        />
      )}

      {mode === 'day' && openPanel === 'day' && (
        <DayCalendar
          draft={draft}
          monthNames={monthNames}
          weekdayNames={weekdayNames}
          years={years}
          updateDraft={updateDraft}
          yearLabel={t('dateFilterYear')}
          monthLabel={t('dateFilterMonth')}
        />
      )}

      {mode === 'range' && (
        <div className="ndfb-fields ndfb-fields--range">
          <Input
            type="date"
            size="sm"
            containerClassName="ndfb-field ndfb-field--date"
            value={draft.rangeStart}
            onChange={(event: any) => updateDraft({ rangeStart: event.target.value })}
            aria-label={t('dateFilterFrom')}
          />
          <span className="ndfb-range-separator" aria-hidden="true">-</span>
          <Input
            type="date"
            size="sm"
            containerClassName="ndfb-field ndfb-field--date"
            value={draft.rangeEnd}
            min={draft.rangeStart}
            onChange={(event: any) => updateDraft({ rangeEnd: event.target.value })}
            aria-label={t('dateFilterTo')}
          />
        </div>
      )}

      {mode !== 'all' && (
        <span className={`ndfb-period-badge${isDirty ? ' ndfb-period-badge--pending' : ''}`} title={draftLabel}>
          {draftLabel}
        </span>
      )}

      <div className="ndfb-actions">
        <Button
          type="button"
          size="sm"
          variant="primary"
          className="ndfb-apply-btn"
          onClick={apply}
          disabled={!isDirty}
        >
          {t('dateFilterApply')}
        </Button>
        <Button
          type="button"
          size="auto"
          variant="raw"
          className="ndfb-reset-btn"
          onClick={reset}
          title={t('dateFilterReset')}
          aria-label={t('dateFilterReset')}
        >
          ↺
        </Button>
      </div>
    </div>
  );
}
