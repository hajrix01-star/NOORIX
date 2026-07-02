import React from 'react';
import { fmt } from '../../../../../utils/format';
import { ACHIEVEMENT_BG, achievementBandFromRatio } from '../utils/calendarAchievementUtils';

export interface DashboardCalendarDayCellProps {
  item: any;
  isSelectionMode: boolean;
  selectedDates: Set<string>;
  selectedDay: any;
  dayNotes: Record<string, string>;
  maxAmount: number;
  t: (key: string, ...args: unknown[]) => string;
  onDayClick: (item: any, isShift: boolean) => void;
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
  let bg = 'var(--noorix-bg-muted)';
  if (amount > 0) {
    if (special) {
      const hex = (specialColor || '#8b5cf6').replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      bg = `rgba(${r},${g},${b},0.35)`;
    } else if (dayTarget != null && dayTarget > 0) {
      const ratio = amount / dayTarget;
      const band = achievementBandFromRatio(ratio);
      bg = ACHIEVEMENT_BG[band as keyof typeof ACHIEVEMENT_BG];
    } else {
      const intensity = Math.min(1, amount / maxAmount);
      bg = `color-mix(in srgb, var(--color-nx-profit) ${Math.round(16 + intensity * 26)}%, transparent)`;
    }
  } else if (special && specialColor) {
    const hex = specialColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    bg = `rgba(${r},${g},${b},0.2)`;
  }
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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e: React.MouseEvent) => onDayClick(item, e.shiftKey)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') onDayClick(item, e.shiftKey);
      }}
      className="aspect-square rounded-md flex flex-col items-center justify-center p-px min-h-10 sm:min-h-12 cursor-pointer relative max-md:text-[10px]"
      style={{
        background: bg,
        border: cellBorder,
      }}
      title={`${dateStr}: ${fmt(amount)} SR${dayTarget != null ? ` | ${t('dashboardSalesTarget')}: ${fmt(dayTarget)}` : ''}${special ? ` | ${special.name || ''}` : ''}${hasNote ? ` | ${hasNote}` : ''}`}
    >
      <span className="text-[12px] max-md:text-[10px] font-bold text-noorix-text leading-none">{day}</span>
      <span
        className="text-[11px] max-md:text-[9px] nx-font-numbers leading-tight"
        style={{
          color:
            amount <= 0
              ? 'var(--noorix-text-muted)'
              : special
                ? 'var(--noorix-text)'
                : ratioVsTarget != null && ratioVsTarget >= 1.2
                  ? 'var(--color-nx-sales)'
                  : ratioVsTarget != null && ratioVsTarget >= 1
                    ? 'var(--color-nx-profit)'
                    : ratioVsTarget != null && ratioVsTarget >= 0.8
                      ? 'var(--noorix-accent-amber)'
                      : ratioVsTarget != null
                        ? 'var(--color-nx-expenses)'
                        : 'var(--color-nx-profit)',
        }}
      >
        {fmt(amount, 0)}
      </span>
      {achieved && (
        <span
          className="text-[8px]"
          style={{
            color: ratioVsTarget != null && ratioVsTarget >= 1.2 ? 'var(--color-nx-sales)' : 'var(--color-nx-profit)',
          }}
        >
          ✓
        </span>
      )}
      {hasNote && (
        <span className="text-[8px] w-[6px] h-[6px] rounded-full inline-block bg-noorix-blue text-noorix-blue" />
      )}
      {special && specialColor && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-md" style={{ background: specialColor }} />
      )}
    </div>
  );
}
