import { useMemo } from 'react';
import type { EmployeeOption } from '../types';

/** تصفية الموظفين النشطين — نفس شرط الفلترة السابق */
export function useHrQuickEntryRows(employees: EmployeeOption[]) {
  const activeEmployees = useMemo(
    () => (employees || []).filter((e) => e.status !== 'terminated' && e.status !== 'archived'),
    [employees],
  );
  return { activeEmployees };
}
