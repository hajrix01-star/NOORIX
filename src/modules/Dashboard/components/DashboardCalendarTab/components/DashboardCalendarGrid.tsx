import React from 'react';
import { DOW_LABELS, DOW_LABELS_AR } from '../constants';
import DashboardCalendarDayCell from './DashboardCalendarDayCell';

export interface DashboardCalendarGridProps {
  year: number;
  month: number;
  lang: string;
  isLoading: boolean;
  daysInMonth: any[];
  isSelectionMode: boolean;
  selectedDates: Set<string>;
  selectedDay: any;
  dayNotes: Record<string, string>;
  maxAmount: number;
  t: (key: string, ...args: unknown[]) => string;
  onDayClick: (item: any, isShift: boolean) => void;
}

export default function DashboardCalendarGrid({
  year,
  month,
  lang,
  isLoading,
  daysInMonth,
  isSelectionMode,
  selectedDates,
  selectedDay,
  dayNotes,
  maxAmount,
  t,
  onDayClick,
}: DashboardCalendarGridProps) {
  if (isLoading) {
    return <div className="text-center text-noorix-muted text-[13px] p-8">{t('loading')}</div>;
  }

  const firstDow = new Date(year, month - 1, 1).getDay();
  const blanks = Array(firstDow).fill(null);
  const cells = [...blanks, ...daysInMonth];

  return (
    <div className="noorix-calendar-grid-scroll">
      <div className="noorix-calendar-grid-scroll-inner">
        <div className="grid gap-1.5 grid-cols-7">
          {([0, 1, 2, 3, 4, 5, 6] as const).map((d) => (
            <div key={d} className="text-[12px] font-bold text-noorix-muted text-center py-1.5">
              {lang === 'ar' ? DOW_LABELS_AR[d] : DOW_LABELS[d]}
            </div>
          ))}
          {cells.map((item: any, i: number) => {
            if (!item) return <div key={`b-${i}`} />;
            return (
              <DashboardCalendarDayCell
                key={item.dateStr}
                item={item}
                isSelectionMode={isSelectionMode}
                selectedDates={selectedDates}
                selectedDay={selectedDay}
                dayNotes={dayNotes}
                maxAmount={maxAmount}
                t={t}
                onDayClick={onDayClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
