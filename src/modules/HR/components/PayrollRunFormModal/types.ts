/**
 * Types for payroll run form modal — display/data shapes only; no business rule changes.
 */

export type PayrollRunFormModalProps = {
  companyId?: string;
  runId?: string | null;
  onCreate?: () => void;
  onClose?: () => void;
};

/** One editable row in the payroll run form (mirrors prior inline object). */
export type PayrollRunLineItem = {
  employeeId: string;
  employeeName: string;
  grossSalary: number;
  allowancesAdd: number;
  deductions: number;
  advancesDeduct: number;
  netSalary: number;
  deferAdvances: boolean;
  advanceDates: string;
  notes: string | undefined;
};

export type PayrollAdvanceDueRow = {
  id: string;
  transactionDate: unknown;
  remaining: number;
  fullRemaining: number;
  isDeferred: boolean;
  installmentCount: number | null;
  installmentAmount: number | null;
};
