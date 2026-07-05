import React from 'react';
import { Button, Toolbar } from '../../../../../ui';

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
      <div className="dashboard-calendar-header-title text-[13px] font-bold">
        {t('dashboardCalendar')} — {monthLabel} {year}
      </div>
      <Toolbar className="gap-2" printHidden={false}>
        <Button size="sm" variant={isSelectionMode ? 'primary' : undefined} onClick={onToggleSelectionMode}>
          {isSelectionMode ? '✓ ' + t('dashboardSelectDaysModeOff') : '☑ ' + t('dashboardSelectDaysMode')}
        </Button>
        <Button size="sm" onClick={onToggleTargetsPanel}>
          ⚙ {t('dashboardSetTarget')}
        </Button>
        <Button size="sm" variant="primary" onClick={onPrintCalendar}>
          {t('print')}
        </Button>
      </Toolbar>
    </div>
  );
}
