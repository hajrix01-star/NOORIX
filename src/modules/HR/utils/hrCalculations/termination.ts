import { toYmd } from '../../../../utils/saudiDate';
import { roundMoney2 } from '../../../../utils/moneyInput';
import { computeEmployeeSalaryPackageBreakdown } from '../employeeSalaryMath';
import { getEmploymentProrationInMonth } from '../payrollAttendanceMath';

export type TerminationSalarySettlementInput = {
  employee: Record<string, unknown> | null | undefined;
  terminationDate: unknown;
  customAllowanceTotal?: unknown;
  advancesRemaining?: unknown;
};

export type TerminationSalarySettlementPreview = {
  payrollMonthFirstDay: string;
  fullMonthly: number;
  pr: ReturnType<typeof getEmploymentProrationInMonth>;
  grossProrated: number;
  advancesRemaining: number;
  netSuggested: number;
};

function toMoneyNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function getTerminationPayrollMonthFirstDay(terminationDate: unknown): string | null {
  const ymd = toYmd(terminationDate);
  if (ymd.length < 7) return null;
  return `${ymd.slice(0, 7)}-01`;
}

export function computeTerminationSalarySettlementPreview(
  input: TerminationSalarySettlementInput,
): TerminationSalarySettlementPreview | null {
  const { employee, terminationDate } = input;
  if (!employee) return null;

  const payrollMonthFirstDay = getTerminationPayrollMonthFirstDay(terminationDate);
  if (!payrollMonthFirstDay) return null;

  const customAllowanceTotal = toMoneyNumber(input.customAllowanceTotal);
  const advancesRemaining = roundMoney2(Math.max(0, toMoneyNumber(input.advancesRemaining)));
  const fullMonthly = computeEmployeeSalaryPackageBreakdown(employee, customAllowanceTotal).total;
  const pr = getEmploymentProrationInMonth(employee, payrollMonthFirstDay);
  const grossProrated = roundMoney2(fullMonthly * pr.factor);
  const netSuggested = roundMoney2(Math.max(0, grossProrated - advancesRemaining));

  return {
    payrollMonthFirstDay,
    fullMonthly,
    pr,
    grossProrated,
    advancesRemaining,
    netSuggested,
  };
}
