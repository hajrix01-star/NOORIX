/** Validation helpers — same checks as before, no new rules. */

export function payrollMonthAlreadyExists(monthStr: string, existingMonthSet: Set<string>): boolean {
  return Boolean(monthStr && existingMonthSet.has(monthStr));
}
