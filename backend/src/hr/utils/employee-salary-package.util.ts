import Decimal from 'decimal.js';

export const HR_SAUDI_STANDARD_HOURS = 8;
export const HR_SAUDI_WORK_DAYS_STANDARD = 26;
export const HR_SAUDI_STANDARD_MONTHLY_HOURS = HR_SAUDI_WORK_DAYS_STANDARD * HR_SAUDI_STANDARD_HOURS;
export const HR_DEFAULT_OVERTIME_WORK_DAYS = 26;

const NOORIX_WD_RE = /\[NOORIX_WD:(\d{1,2})\]/;

export type HrEmployeeSalaryPackageInput = {
  basicSalary?: unknown;
  housingAllowance?: unknown;
  transportAllowance?: unknown;
  otherAllowance?: unknown;
  workHours?: string | null;
  workSchedule?: string | null;
};

export type HrEmployeeSalaryPackageBreakdown = {
  basicSalary: Decimal;
  housingAllowance: Decimal;
  transportAllowance: Decimal;
  otherAllowance: Decimal;
  customAllowanceTotal: Decimal;
  overtimeHoursPerDay: number;
  overtimePay: Decimal;
  fixedTotal: Decimal;
  total: Decimal;
};

export type HrCustomAllowanceAmountRow = {
  amount?: unknown;
};

function decimal(value: unknown): Decimal {
  if (value === null || value === undefined || value === '') return new Decimal(0);
  return new Decimal(String(value));
}

export function sumHrCustomAllowanceAmounts(rows: HrCustomAllowanceAmountRow[] | null | undefined): number {
  const total = (rows ?? []).reduce((sum, row) => {
    const amount = Number(row?.amount ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  return Math.round(total * 100) / 100;
}

export function parseHrEmployeeWorkHours(value: string | null | undefined): number {
  if (!value) return HR_SAUDI_STANDARD_HOURS;
  const match = String(value).match(/(\d+(?:\.\d+)?)/);
  return match ? Math.max(1, Math.min(12, parseFloat(match[1]))) : HR_SAUDI_STANDARD_HOURS;
}

export function parseHrEmployeeOvertimeWorkDaysPerMonth(emp: { workSchedule?: string | null }): number {
  const match = String(emp?.workSchedule || '').match(NOORIX_WD_RE);
  if (match) {
    const days = parseInt(match[1], 10);
    if (Number.isFinite(days)) return Math.min(31, Math.max(1, days));
  }
  return HR_DEFAULT_OVERTIME_WORK_DAYS;
}

export function computeHrEmployeeSalaryPackage(
  emp: HrEmployeeSalaryPackageInput,
  customAllowanceTotal: unknown = 0,
): HrEmployeeSalaryPackageBreakdown {
  const basicSalary = decimal(emp?.basicSalary);
  const housingAllowance = decimal(emp?.housingAllowance);
  const transportAllowance = decimal(emp?.transportAllowance);
  const otherAllowance = decimal(emp?.otherAllowance);
  const customAllowance = decimal(customAllowanceTotal);
  const fixedTotal = basicSalary
    .plus(housingAllowance)
    .plus(transportAllowance)
    .plus(otherAllowance)
    .plus(customAllowance);

  const workDays = parseHrEmployeeOvertimeWorkDaysPerMonth(emp);
  const hours = parseHrEmployeeWorkHours(emp?.workHours);
  const regularWorkDays = Math.min(workDays, HR_SAUDI_WORK_DAYS_STANDARD);
  const restDays = Math.max(0, workDays - HR_SAUDI_WORK_DAYS_STANDARD);
  const overtimeHoursPerDay = Math.max(0, hours - HR_SAUDI_STANDARD_HOURS);
  const totalDailyOvertime = overtimeHoursPerDay * regularWorkDays;
  const totalRestOvertime = restDays * hours;
  const totalOvertime = totalDailyOvertime + totalRestOvertime;
  const overtimePay =
    totalOvertime > 0 && fixedTotal.gt(0)
      ? fixedTotal.plus(basicSalary.times(0.5)).div(HR_SAUDI_STANDARD_MONTHLY_HOURS).times(totalOvertime)
      : new Decimal(0);

  return {
    basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowance,
    customAllowanceTotal: customAllowance,
    overtimeHoursPerDay,
    overtimePay,
    fixedTotal,
    total: fixedTotal.plus(overtimePay),
  };
}

export function totalHrEmployeeSalaryPackageMonthly(
  emp: HrEmployeeSalaryPackageInput,
  customAllowanceTotal: unknown = 0,
  decimalPlaces = 2,
): number {
  return computeHrEmployeeSalaryPackage(emp, customAllowanceTotal)
    .total
    .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
    .toNumber();
}
