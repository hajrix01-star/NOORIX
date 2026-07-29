import React from 'react';
import { Button } from '../../../ui';
import { HrSegmentedControl } from './HrSegmentedControl';
import { HrTabToolbar } from './HrTabToolbar';
import type { HrEmployeeTab } from '../../../types/api';

type TranslationFn = (key: string) => string;

type StaffListToolbarProps = {
  t: TranslationFn;
  items: Array<{ id: HrEmployeeTab; label: React.ReactNode }>;
  viewMode: HrEmployeeTab;
  onViewModeChange: (id: string) => void;
  onOpenImportExport: () => void;
  onAddEmployee: () => void;
};

function ImportIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function StaffListToolbar({
  t,
  items,
  viewMode,
  onViewModeChange,
  onOpenImportExport,
  onAddEmployee,
}: StaffListToolbarProps) {
  return (
    <HrTabToolbar
      leading={(
        <HrSegmentedControl
          tone="filter"
          className="nx-hr-view-modes w-full min-w-0"
          items={items}
          value={viewMode}
          onChange={onViewModeChange}
        />
      )}
      desktopActions={(
        <Button
          size="sm"
          className="hidden lg:inline-flex shrink-0 whitespace-nowrap"
          icon={<ImportIcon />}
          onClick={onOpenImportExport}
        >
          {t('importExportLabel')}
        </Button>
      )}
      menuItems={[{ key: 'import', label: t('importExportLabel'), onClick: onOpenImportExport }]}
      primaryAction={{ label: t('addEmployee'), onClick: onAddEmployee }}
    />
  );
}
