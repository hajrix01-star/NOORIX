import { roundMoney2 } from '../../../../utils/moneyInput';

export type PayrollLineNetInput = {
  grossSalary?: unknown;
  allowancesAdd?: unknown;
  deductions?: unknown;
  advancesDeduct?: unknown;
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
