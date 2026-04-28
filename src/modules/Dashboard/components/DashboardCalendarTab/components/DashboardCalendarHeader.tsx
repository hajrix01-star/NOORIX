import React from 'react';
import { CARD_COLORS } from '../../../../../utils/cardStyles';
import { Button } from '../../../../../ui';

export interface DashboardCalendarHeaderProps {
  monthLabel: string;
  year: number;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  onToggleTargetsPanel: () => void;
  onPrintCalendar: () => void;
  t: (key: string, ...args: unknown[]) => string;
}

export default function DashboardCalendarHeader({
  monthLabel,
  year,
  isSelectionMode,
  onToggleSelectionMode,
  onToggleTargetsPanel,
  onPrintCalendar,
  t,
}: DashboardCalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between flex flex-wrap gap-2 mb-3">
      <div className="text-[13px] font-bold" style={{ color: CARD_COLORS.sales.accent }}>
        {t('dashboardCalendar')} — {monthLabel} {year}
      </div>
      <div className="nx-toolbar">
        <Button size="sm" variant={isSelectionMode ? 'primary' : undefined} onClick={onToggleSelectionMode}>
          {isSelectionMode ? '✓ ' + t('dashboardSelectDaysModeOff') : '☑ ' + t('dashboardSelectDaysMode')}
        </Button>
        <Button size="sm" onClick={onToggleTargetsPanel}>
          ⚙ {t('dashboardSetTarget')}
        </Button>
        <Button size="sm" variant="primary" onClick={onPrintCalendar}>
          {t('print')}
        </Button>
      </div>
    </div>
  );
}
