export type HrPayrollLineNetInput = {
  grossSalary?: unknown;
  allowancesAdd?: unknown;
  deductions?: unknown;
  advancesDeduct?: unknown;
};

function toMoneyNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function computeHrPayrollLineNet(input: HrPayrollLineNetInput): number {
  const gross = toMoneyNumber(input.grossSalary);
  const add = toMoneyNumber(input.allowancesAdd);
  const deductions = toMoneyNumber(input.deductions);
  const advances = toMoneyNumber(input.advancesDeduct);
  return Math.round(Math.max(0, gross + add - deductions - advances) * 100) / 100;
}
