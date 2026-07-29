import React from 'react';
import type { HrEmployeeTab } from '../../types/api';

type Translate = (key: string) => string;

type StaffEmployeeViewModeItem = {
  id: HrEmployeeTab;
  label: React.ReactNode;
};

const STAFF_EMPLOYEE_VIEW_MODE_DEFS = [
  { id: 'active', fullKey: 'activeEmployeesList', shortKey: 'activeEmployeesListShort' },
  { id: 'terminated', fullKey: 'terminatedEmployeesList', shortKey: 'terminatedEmployeesListShort' },
  { id: 'archived', fullKey: 'archivedEmployeesList', shortKey: 'archivedEmployeesListShort' },
] as const;

export function buildStaffEmployeeViewModeItems(t: Translate): StaffEmployeeViewModeItem[] {
  return STAFF_EMPLOYEE_VIEW_MODE_DEFS.map(({ id, fullKey, shortKey }) => {
    const full = t(fullKey);
    const short = t(shortKey);
    const label =
      short === full ? (
        full
      ) : (
        <>
          <span className="hidden sm:inline">{full}</span>
          <span className="sm:hidden">{short}</span>
        </>
      );
    return { id, label };
  });
}
