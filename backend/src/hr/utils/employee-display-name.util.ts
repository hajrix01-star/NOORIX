type EmpName = { name?: string | null; nameEn?: string | null };

export function employeeDisplayNameForNotes(emp: EmpName): string {
  return (emp.name || emp.nameEn || '').trim() || '—';
}
