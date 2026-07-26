import React from 'react';
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

  return (
    <div className={styles.root} data-testid="date-picker-calendar">
      <div className={styles.header} dir="ltr">
        <button
          type="button"
          className={styles.nav}
          aria-label={language === 'en' ? 'Previous month' : 'الشهر السابق'}
          onClick={() => onShiftMonth(-1)}
        >
          ‹
        </button>
        <select
          className={styles.select}
          dir={rtl ? 'rtl' : 'ltr'}
          aria-label={language === 'en' ? 'Month' : 'الشهر'}
          value={month}
          onChange={(event) => onMonthChange(Number(event.target.value))}
        >
          {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
        </select>
        <select
          className={styles.select}
          aria-label={language === 'en' ? 'Year' : 'السنة'}
          value={year}
          onChange={(event) => onYearChange(Number(event.target.value))}
        >
          {years.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button
          type="button"
          className={styles.nav}
          aria-label={language === 'en' ? 'Next month' : 'الشهر التالي'}
          onClick={() => onShiftMonth(1)}
        >
          ›
        </button>
      </div>

      <div className={styles.weekdays} dir={rtl ? 'rtl' : 'ltr'} role="row">
        {weekdayNames.map((name) => <span key={name} className={styles.weekday} role="columnheader">{name}</span>)}
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
                    onClick={() => onSelectDay(day)}
                  >
                    {day}
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
