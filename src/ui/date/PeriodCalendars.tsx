import React, { useState } from 'react';
import {
  lastDayOfMonth,
  normalizeDateSpan,
  normalizeYearSpan,
  ymd,
  type DatePeriodState,
} from './datePeriod';
import Button from '../Button';
import { DatePeriodSelect, type DatePeriodSelectOption } from './DatePeriodControls';

export type DatePeriodCalendarProps = {
  draft: DatePeriodState;
  years: number[];
  updateDraft: (patch: Partial<DatePeriodState>) => void;
};

export type MonthRangeCalendarProps = DatePeriodCalendarProps & {
  monthNames: string[];
  yearLabel: string;
};

export type YearRangeCalendarProps = DatePeriodCalendarProps & {
  yearLabel: string;
};

export type QuarterCalendarProps = DatePeriodCalendarProps & {
  quarterLabel: string;
  yearLabel: string;
};

export type DayRangeCalendarProps = DatePeriodCalendarProps & {
  monthNames: string[];
  weekdayNames: string[];
  yearLabel: string;
  monthLabel: string;
};

function monthIndex(year: number, month: number) {
  return year * 12 + month;
}

function parseYmd(value: string) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  return { year: year || 0, month: month || 0, day: day || 0 };
}

function yearOptions(years: number[]): DatePeriodSelectOption[] {
  return years.map((year) => ({ value: year, label: year }));
}

function monthOptions(monthNames: string[]): DatePeriodSelectOption[] {
  return monthNames.map((name, index) => ({ value: index + 1, label: name }));
}

function isMonthInDraftRange(draft: DatePeriodState, year: number, month: number) {
  const start = monthIndex(draft.monthRangeStartYear, draft.monthRangeStartMonth);
  const end = monthIndex(draft.monthRangeEndYear, draft.monthRangeEndMonth);
  const value = monthIndex(year, month);
  return value >= Math.min(start, end) && value <= Math.max(start, end);
}

export function MonthRangeCalendar({
  draft,
  monthNames,
  years,
  updateDraft,
  yearLabel,
}: MonthRangeCalendarProps) {
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
          <DatePeriodSelect
            label={yearLabel}
            className="ndfb-calendar-year-select"
            value={calendarYear}
            options={yearOptions(years)}
            onValueChange={(value) => selectYear(Number(value))}
          />
        </div>
        <div className="ndfb-month-grid">
          {monthNames.map((name, index) => {
            const month = index + 1;
            const active = isMonthInDraftRange(draft, calendarYear, month);
            return (
              <Button
                variant="raw"
                key={month}
                type="button"
                className={`ndfb-month-cell${active ? ' ndfb-month-cell--active' : ''}`}
                aria-label={name}
                onClick={() => selectMonth(month)}
              >
                {name}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function isYearInDraftRange(draft: DatePeriodState, year: number) {
  const span = normalizeYearSpan(draft.yearRangeStart || draft.selYear, draft.yearRangeEnd || draft.selYear);
  return year >= span.startYear && year <= span.endYear;
}

export function YearRangeCalendar({ draft, years, updateDraft, yearLabel }: YearRangeCalendarProps) {
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
            <Button
              variant="raw"
              key={year}
              type="button"
              className={`ndfb-year-cell${isYearInDraftRange(draft, year) ? ' ndfb-year-cell--active' : ''}`}
              aria-label={String(year)}
              onClick={() => selectYear(year)}
            >
              {year}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function QuarterCalendar({
  draft,
  years,
  updateDraft,
  quarterLabel,
  yearLabel,
}: QuarterCalendarProps) {
  const quarters = [1, 2, 3, 4];
  const selectedQuarter = draft.selQuarter || Math.ceil((draft.selMonth || 1) / 3);

  return (
    <div className="ndfb-calendar ndfb-calendar--quarters">
      <div className="ndfb-calendar-panel">
        <div className="ndfb-calendar-panel__head">
          <span>{quarterLabel}</span>
        </div>
        <div className="ndfb-compact-choice-grid ndfb-compact-choice-grid--years">
          <span className="ndfb-compact-choice-label">{yearLabel}</span>
          {years.map((year) => (
            <Button
              variant="raw"
              key={year}
              type="button"
              className={`ndfb-year-cell${draft.selYear === year ? ' ndfb-year-cell--active' : ''}`}
              aria-label={String(year)}
              onClick={() => updateDraft({ selYear: year })}
            >
              {year}
            </Button>
          ))}
        </div>
        <div className="ndfb-compact-choice-grid ndfb-compact-choice-grid--quarters">
          <span className="ndfb-compact-choice-label">{quarterLabel}</span>
          {quarters.map((quarter) => (
            <Button
              variant="raw"
              key={quarter}
              type="button"
              className={`ndfb-year-cell${selectedQuarter === quarter ? ' ndfb-year-cell--active' : ''}`}
              aria-label={`Q${quarter}`}
              onClick={() => updateDraft({ selQuarter: quarter })}
            >
              {`Q${quarter}`}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function getDayRangeState(draft: DatePeriodState, date: string) {
  const span = normalizeDateSpan(draft.rangeStart || draft.selDay, draft.rangeEnd || draft.selDay);
  if (!span.startDate || !span.endDate || date < span.startDate || date > span.endDate) return 'none';
  if (date === span.startDate || date === span.endDate) return 'edge';
  return 'middle';
}

export function DayRangeCalendar({
  draft,
  monthNames,
  weekdayNames,
  years,
  updateDraft,
  yearLabel,
  monthLabel,
}: DayRangeCalendarProps) {
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
            <DatePeriodSelect
              label={yearLabel}
              className="ndfb-calendar-year-select"
              value={calendarYear}
              options={yearOptions(years)}
              onValueChange={(value) => setCalendarMonth(Number(value), calendarMonth)}
            />
            <DatePeriodSelect
              label={monthLabel}
              className="ndfb-calendar-month-select"
              value={calendarMonth}
              options={monthOptions(monthNames)}
              onValueChange={(value) => setCalendarMonth(calendarYear, Number(value))}
            />
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
            const rangeState = getDayRangeState(draft, date);
            return (
              <Button
                variant="raw"
                key={date}
                type="button"
                className={[
                  'ndfb-day-cell',
                  rangeState === 'edge' ? 'ndfb-day-cell--active ndfb-day-cell--range-edge' : '',
                  rangeState === 'middle' ? 'ndfb-day-cell--range-middle' : '',
                ].filter(Boolean).join(' ')}
                aria-label={date}
                onClick={() => selectDay(day)}
              >
                {day}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
