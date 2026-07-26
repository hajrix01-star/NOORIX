import React, { useState } from 'react';
import { lastDayOfMonth, ymd } from './datePeriod';
import type { NoorixDateLanguage } from './dateLocale';
import styles from './DatePickerCalendar.module.css';

type YearOption = {
  value: number;
  label: number;
};

type DatePickerCalendarProps = {
  language: NoorixDateLanguage;
  year: number;
  month: number;
  value: string;
  min?: string;
  max?: string;
  monthNames: string[];
  weekdayNames: string[];
  years: YearOption[];
  onShiftMonth: (delta: number) => void;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onSelectDay: (day: number) => void;
};

const isBlocked = (date: string, min?: string, max?: string) =>
  (!!min && date < min) || (!!max && date > max);

export default function DatePickerCalendar({
  language,
  year,
  month,
  value,
  min,
  max,
  monthNames,
  weekdayNames,
  years,
  onShiftMonth,
  onYearChange,
  onMonthChange,
  onSelectDay,
}: DatePickerCalendarProps) {
  const [periodOpen, setPeriodOpen] = useState(false);
  const daysCount = lastDayOfMonth(year, month);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const weekCount = Math.ceil((firstWeekday + daysCount) / 7);
  const weeks = Array.from({ length: weekCount }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, weekdayIndex) => {
      const day = weekIndex * 7 + weekdayIndex - firstWeekday + 1;
      return day >= 1 && day <= daysCount ? day : null;
    }),
  );
  const rtl = language === 'ar';
  const yearIndex = years.findIndex((option) => option.value === year);
  const previousYear = yearIndex > 0 ? years[yearIndex - 1]?.value : null;
  const nextYear = yearIndex >= 0 && yearIndex < years.length - 1 ? years[yearIndex + 1]?.value : null;
  const calendarTitle = `${monthNames[month - 1]} ${year}`;
  const weekdayLabels = rtl ? ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'] : weekdayNames;
  const minMonth = min?.slice(0, 7) ?? '';
  const maxMonth = max?.slice(0, 7) ?? '';
  const monthKey = (targetYear: number, targetMonth: number) => `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const isMonthBlocked = (targetYear: number, targetMonth: number) => {
    const key = monthKey(targetYear, targetMonth);
    return (minMonth !== '' && key < minMonth) || (maxMonth !== '' && key > maxMonth);
  };
  const adjacentMonth = (delta: number) => new Date(year, month - 1 + delta, 1);
  const previousMonth = adjacentMonth(-1);
  const nextMonth = adjacentMonth(1);
  const previousMonthBlocked = isMonthBlocked(previousMonth.getFullYear(), previousMonth.getMonth() + 1);
  const nextMonthBlocked = isMonthBlocked(nextMonth.getFullYear(), nextMonth.getMonth() + 1);

  const handleDayKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, day: number) => {
    const delta = event.key === 'ArrowRight' ? (rtl ? -1 : 1)
      : event.key === 'ArrowLeft' ? (rtl ? 1 : -1)
        : event.key === 'ArrowDown' ? 7
          : event.key === 'ArrowUp' ? -7
            : 0;
    if (!delta) return;
    event.preventDefault();
    const targetDay = day + delta;
    if (targetDay < 1 || targetDay > daysCount) return;
    event.currentTarget
      .closest<HTMLElement>('[data-testid="date-picker-calendar"]')
      ?.querySelector<HTMLButtonElement>(`[data-calendar-date="${ymd(year, month, targetDay)}"]`)
      ?.focus();
  };

  return (
    <div className={styles.root} data-testid="date-picker-calendar">
      <div className={styles.header} dir="ltr">
        <button
          type="button"
          className={styles.nav}
          aria-label={language === 'en' ? 'Previous month' : 'الشهر السابق'}
          disabled={previousMonthBlocked}
          onClick={() => onShiftMonth(-1)}
        >
          <span className={styles.controlGlyph} aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          className={styles.periodTrigger}
          dir={rtl ? 'rtl' : 'ltr'}
          aria-label={language === 'en' ? 'Choose month and year' : 'اختيار الشهر والسنة'}
          aria-expanded={periodOpen}
          onClick={() => setPeriodOpen((open) => !open)}
        >
          <span>{calendarTitle}</span>
          <span className={styles.periodChevron} aria-hidden="true">⌄</span>
        </button>
        <button
          type="button"
          className={styles.nav}
          aria-label={language === 'en' ? 'Next month' : 'الشهر التالي'}
          disabled={nextMonthBlocked}
          onClick={() => onShiftMonth(1)}
        >
          <span className={styles.controlGlyph} aria-hidden="true">›</span>
        </button>
      </div>

      {periodOpen ? (
        <div className={styles.periodPanel}>
          <div className={styles.yearNav} dir="ltr">
            <button
              type="button"
              className={styles.yearButton}
              disabled={previousYear === null}
              aria-label={language === 'en' ? 'Previous year' : 'السنة السابقة'}
              onClick={() => previousYear !== null && onYearChange(previousYear)}
            >
              <span className={styles.controlGlyph} aria-hidden="true">‹</span>
            </button>
            <strong>{year}</strong>
            <button
              type="button"
              className={styles.yearButton}
              disabled={nextYear === null}
              aria-label={language === 'en' ? 'Next year' : 'السنة التالية'}
              onClick={() => nextYear !== null && onYearChange(nextYear)}
            >
              <span className={styles.controlGlyph} aria-hidden="true">›</span>
            </button>
          </div>
          <div className={styles.monthGrid}>
            {monthNames.map((name, index) => {
              const monthValue = index + 1;
              const blocked = isMonthBlocked(year, monthValue);
              return (
                <button
                  type="button"
                  key={name}
                  className={`${styles.monthButton}${monthValue === month ? ` ${styles.monthButtonActive}` : ''}`}
                  aria-label={`${name} ${year}`}
                  disabled={blocked}
                  onClick={() => {
                    onMonthChange(monthValue);
                    setPeriodOpen(false);
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className={styles.weekdays} dir={rtl ? 'rtl' : 'ltr'} role="row">
        {weekdayNames.map((name, index) => (
          <span key={name} className={styles.weekday} role="columnheader" aria-label={name}>
            {weekdayLabels[index]}
          </span>
        ))}
      </div>

      <div
        className={styles.weeks}
        dir={rtl ? 'rtl' : 'ltr'}
        role="grid"
        aria-label={language === 'en' ? 'Calendar' : 'التقويم'}
      >
        {weeks.map((week, weekIndex) => (
          <div key={`week-${weekIndex}`} className={styles.week} role="row" data-calendar-week>
            {week.map((day, weekdayIndex) => {
              if (day === null) {
                return <span key={`blank-${weekIndex}-${weekdayIndex}`} className={styles.cell} role="gridcell" aria-hidden="true" />;
              }
              const date = ymd(year, month, day);
              const active = date === value;
              const blocked = isBlocked(date, min, max);
              return (
                <span key={date} className={styles.cell} role="gridcell" aria-selected={active}>
                  <button
                    type="button"
                    disabled={blocked}
                    className={`${styles.day}${active ? ` ${styles.active}` : ''}${blocked ? ` ${styles.disabled}` : ''}`}
                    aria-label={date}
                    data-calendar-date={date}
                    onKeyDown={(event) => handleDayKeyDown(event, day)}
                    onClick={() => onSelectDay(day)}
                  >
                    <span className={styles.dayLabel}>{day}</span>
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
