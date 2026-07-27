import React from 'react';
import { ColorSwatch, RuntimeStyleBox } from '../../../../../ui';
import { fmt } from '../../../../../utils/format';
import type { DashboardCalendarDay } from '../../../../../types/api/domains/dashboard';
import { calendarSalesHeatBg, calendarSpecialIdleBg } from '../utils/calendarAchievementUtils';

export interface DashboardCalendarDayCellProps {
  item: DashboardCalendarDay;
  isSelectionMode: boolean;
  selectedDates: Set<string>;
  selectedDay: DashboardCalendarDay | null;
  dayNotes: Record<string, string>;
  maxAmount: number;
  t: (key: string, ...args: unknown[]) => string;
  onDayClick: (item: DashboardCalendarDay, isShift: boolean) => void;
}

export default function DashboardCalendarDayCell({
  item,
  isSelectionMode,
  selectedDates,
  selectedDay,
  dayNotes,
  maxAmount,
  t,
  onDayClick,
}: DashboardCalendarDayCellProps) {
  const { day, dateStr, amount, dayTarget, special } = item;
  const isSelected = isSelectionMode && selectedDates.has(dateStr);
  const specialColor = special ? special.color || '#8b5cf6' : null;
  const bg = amount > 0
    ? calendarSalesHeatBg(amount, dayTarget, maxAmount)
    : calendarSpecialIdleBg(specialColor);
  const achieved = dayTarget != null && amount >= dayTarget;
  const ratioVsTarget = dayTarget != null && dayTarget > 0 ? amount / dayTarget : null;
  let cellBorder = '1px solid var(--noorix-border)';
  if (isSelected) cellBorder = '2px solid var(--noorix-accent-blue)';
  else if (selectedDay?.dateStr === dateStr) cellBorder = '2px solid var(--noorix-accent-blue)';
  else if (ratioVsTarget != null && amount > 0) {
    if (ratioVsTarget >= 1.2) cellBorder = '2px solid var(--color-nx-sales)';
    else if (ratioVsTarget >= 1) cellBorder = '2px solid var(--color-nx-profit)';
    else if (special && specialColor) cellBorder = `2px solid ${specialColor}`;
  } else if (special && specialColor) cellBorder = `2px solid ${specialColor}`;
  const hasNote = dayNotes[dateStr];
  const amountClass =
    amount <= 0
      ? 'text-noorix-muted'
      : ratioVsTarget != null && ratioVsTarget >= 1.2
          ? 'text-[var(--color-nx-sales)]'
          : ratioVsTarget != null && ratioVsTarget >= 1
            ? 'text-[var(--color-nx-profit)]'
            : ratioVsTarget != null && ratioVsTarget >= 0.8
              ? 'text-[var(--noorix-accent-amber)]'
              : ratioVsTarget != null
                ? 'text-[var(--color-nx-expenses)]'
                : 'text-[var(--color-nx-profit)]';
  const achievedClass =
    ratioVsTarget != null && ratioVsTarget >= 1.2
      ? 'text-[var(--color-nx-sales)]'
      : 'text-[var(--color-nx-profit)]';

  return (
    <RuntimeStyleBox
      role="button"
      tabIndex={0}
      onClick={(e: React.MouseEvent) => onDayClick(item, e.shiftKey)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') onDayClick(item, e.shiftKey);
      }}
      className="aspect-square rounded-md flex flex-col items-center justify-center p-px min-h-10 sm:min-h-12 cursor-pointer relative max-md:text-[10px]"
      background={bg}
      border={cellBorder}
      title={`${dateStr}: ${fmt(amount)} SR${dayTarget != null ? ` | ${t('dashboardSalesTarget')}: ${fmt(dayTarget)}` : ''}${special ? ` | ${special.name || ''}` : ''}${hasNote ? ` | ${hasNote}` : ''}`}
    >
      <span className="text-[12px] max-md:text-[10px] font-bold text-noorix-text leading-none">{day}</span>
      <span
        className={`text-[11px] max-md:text-[9px] nx-font-numbers leading-tight ${amountClass}`}
      >
        {fmt(amount, 0)}
      </span>
      {achieved && (
        <span
          className={`text-[8px] ${achievedClass}`}
        >
          ✓
        </span>
      )}
      {hasNote && (
        <span className="text-[8px] w-[6px] h-[6px] rounded-full inline-block bg-noorix-blue text-noorix-blue" />
      )}
      {special && specialColor && (
        <ColorSwatch className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-md" color={specialColor} />
      )}
    </RuntimeStyleBox>
  );
}
