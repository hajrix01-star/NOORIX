import { roundMoney2 } from '../../../../utils/moneyInput';

export type PayrollLineNetInput = {
  grossSalary?: unknown;
  allowancesAdd?: unknown;
  deductions?: unknown;
  advancesDeduct?: unknown;
  netSalary?: unknown;
};

export type PayrollLineSummary = {
  grossSalary: number;
  allowancesAdd: number;
  beforeDeductions: number;
  payrollDeductions: number;
  advancesDeduct: number;
  totalDeductions: number;
  netSalary: number;
};

export type PayrollRunTotals = {
  grossSalary: number;
  allowancesAdd: number;
  beforeDeductions: number;
  payrollDeductions: number;
  advancesDeduct: number;
  totalDeductions: number;
  netSalary: number;
};

function toMoneyNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function computePayrollLineNet(input: PayrollLineNetInput): number {
  const gross = toMoneyNumber(input.grossSalary);
  const add = toMoneyNumber(input.allowancesAdd);
  const deductions = toMoneyNumber(input.deductions);
  const advances = toMoneyNumber(input.advancesDeduct);
  return roundMoney2(Math.max(0, gross + add - deductions - advances));
}

export function withComputedPayrollLineNet<T extends PayrollLineNetInput>(row: T): T & { netSalary: number } {
  return {
    ...row,
    netSalary: computePayrollLineNet(row),
  };
}

export function computePayrollLineSummary(input: PayrollLineNetInput): PayrollLineSummary {
  const grossSalary = toMoneyNumber(input.grossSalary);
  const allowancesAdd = toMoneyNumber(input.allowancesAdd);
  const payrollDeductions = toMoneyNumber(input.deductions);
  const advancesDeduct = toMoneyNumber(input.advancesDeduct);
  return {
    grossSalary,
    allowancesAdd,
    beforeDeductions: roundMoney2(grossSalary + allowancesAdd),
    payrollDeductions,
    advancesDeduct,
    totalDeductions: roundMoney2(payrollDeductions + advancesDeduct),
    netSalary: computePayrollLineNet(input),
  };
}

export function computePayrollRunTotals(lines: PayrollLineNetInput[] | null | undefined): PayrollRunTotals {
  const totals: PayrollRunTotals = {
    grossSalary: 0,
    allowancesAdd: 0,
    beforeDeductions: 0,
    payrollDeductions: 0,
    advancesDeduct: 0,
    totalDeductions: 0,
    netSalary: 0,
  };

  for (const line of lines ?? []) {
    const summary = computePayrollLineSummary(line);
    totals.grossSalary += summary.grossSalary;
    totals.allowancesAdd += summary.allowancesAdd;
    totals.beforeDeductions += summary.beforeDeductions;
    totals.payrollDeductions += summary.payrollDeductions;
    totals.advancesDeduct += summary.advancesDeduct;
    totals.totalDeductions += summary.totalDeductions;
    totals.netSalary += summary.netSalary;
  }

  return {
    grossSalary: roundMoney2(totals.grossSalary),
    allowancesAdd: roundMoney2(totals.allowancesAdd),
    beforeDeductions: roundMoney2(totals.beforeDeductions),
    payrollDeductions: roundMoney2(totals.payrollDeductions),
    advancesDeduct: roundMoney2(totals.advancesDeduct),
    totalDeductions: roundMoney2(totals.totalDeductions),
    netSalary: roundMoney2(totals.netSalary),
  };
}
