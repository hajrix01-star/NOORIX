import {
  computeHrPayrollLineNet,
  computeHrPayrollLineSummary,
  computeHrPayrollRunTotals,
  type HrPayrollLineNetInput,
  type HrPayrollLineSummary,
  type HrPayrollRunTotals,
} from '@noorix/finance-core';

export type PayrollLineNetInput = HrPayrollLineNetInput;
export type PayrollLineSummary = HrPayrollLineSummary;
export type PayrollRunTotals = HrPayrollRunTotals;

export function computePayrollLineNet(input: PayrollLineNetInput): number {
  return computeHrPayrollLineNet(input);
}

export function withComputedPayrollLineNet<T extends PayrollLineNetInput>(row: T): T & { netSalary: number } {
  return {
    ...row,
    netSalary: computePayrollLineNet(row),
  };
}

export function computePayrollLineSummary(input: PayrollLineNetInput): PayrollLineSummary {
  return computeHrPayrollLineSummary(input);
}

export function computePayrollRunTotals(lines: PayrollLineNetInput[] | null | undefined): PayrollRunTotals {
  return computeHrPayrollRunTotals(lines);
}
