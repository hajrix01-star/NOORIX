import React from 'react';
import { Button, Toolbar } from '../../../../../ui';

export interface DashboardCalendarSelectionBarProps {
  selectedCount: number;
  onAddSpecial: () => void;
  onClearSelection: () => void;
  t: (key: string, ...args: unknown[]) => string;
}

export default function DashboardCalendarSelectionBar({
  selectedCount,
  onAddSpecial,
  onClearSelection,
  t,
}: DashboardCalendarSelectionBarProps) {
  if (selectedCount <= 0) return null;
  return (
    <div className="mt-3 rounded-lg p-2.5 bg-[var(--noorix-blue-8)] border border-[var(--noorix-blue-20)]">
      <div className="text-[11px] font-bold mb-1.5">
        {t('dashboardSelectedDays')}: {selectedCount}
      </div>
      <Toolbar className="gap-2" printHidden={false}>
        <Button size="sm" variant="primary" onClick={onAddSpecial}>
          + {t('dashboardAddAsSpecialDays')}
        </Button>
        <Button size="sm" onClick={onClearSelection}>
          {t('cancel')}
        </Button>
      </Toolbar>
    </div>
  );
}
