import Decimal from 'decimal.js';
import {
  HR_DEFAULT_OVERTIME_WORK_DAYS,
  HR_SAUDI_DAYS_PER_MONTH,
  HR_SAUDI_STANDARD_HOURS,
  HR_SAUDI_STANDARD_MONTHLY_HOURS,
  HR_SAUDI_WORK_DAYS_STANDARD,
  basicSalaryFromTargetTotalInclusiveOvertime,
  baseSalaryComponentsDecimal,
  computeHrEmployeeSalaryPackage,
  fixedMonthlyPayPackage,
  fixedMonthlyPayPackageDecimal,
  mergeOvertimeWorkDaysIntoSchedule,
  overtimeBreakdownDecimal,
  overtimePay,
  overtimePayDecimal,
  parseOvertimeWorkDaysPerMonth,
  parseWorkHours,
  stripOvertimeWorkDaysTag,
  sumCustomAllowancesForEmployee,
  sumSalaryCustomAllowances,
  totalSalary,
  totalSalaryDecimal,
  type HrCustomAllowanceAmountRow,
} from '@noorix/finance-core';

export {
  basicSalaryFromTargetTotalInclusiveOvertime,
  baseSalaryComponentsDecimal,
  fixedMonthlyPayPackage,
  fixedMonthlyPayPackageDecimal,
  mergeOvertimeWorkDaysIntoSchedule,
  overtimeBreakdownDecimal,
  overtimePay,
  overtimePayDecimal,
  parseOvertimeWorkDaysPerMonth,
  parseWorkHours,
  stripOvertimeWorkDaysTag,
  sumCustomAllowancesForEmployee,
  sumSalaryCustomAllowances,
  totalSalary,
  totalSalaryDecimal,
};

export const SAUDI_STANDARD_HOURS = HR_SAUDI_STANDARD_HOURS;
export const SAUDI_DAYS_PER_MONTH = HR_SAUDI_DAYS_PER_MONTH;
export const SAUDI_WORK_DAYS_STANDARD = HR_SAUDI_WORK_DAYS_STANDARD;
export const SAUDI_STANDARD_MONTHLY_HOURS = HR_SAUDI_STANDARD_MONTHLY_HOURS;
export const DEFAULT_OVERTIME_WORK_DAYS = HR_DEFAULT_OVERTIME_WORK_DAYS;
export const WORK_DAYS_PER_MONTH = HR_DEFAULT_OVERTIME_WORK_DAYS;

export type SalaryCustomAllowanceRow = HrCustomAllowanceAmountRow;

export type EmployeeSalaryPackageBreakdown = {
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowance: number;
  customAllowanceTotal: number;
  overtimeHoursPerDay: number;
  overtimePay: number;
  fixedTotal: number;
  total: number;
};

function roundMoney2(value: Decimal.Value): number {
  return new Decimal(value || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

function salaryDecimal(value: unknown): Decimal {
  return new Decimal((value as Decimal.Value) || 0);
}

function normalizeSalaryCalcHours(value: unknown): number {
  return Math.max(1, Math.min(12, parseFloat(String(value)) || HR_SAUDI_STANDARD_HOURS));
}

function normalizeSalaryCalcDays(value: unknown): number {
  return Math.max(1, parseFloat(String(value)) || HR_DEFAULT_OVERTIME_WORK_DAYS);
}

export function computeEmployeeSalaryPackageBreakdown(
  employee: Record<string, unknown> | null | undefined,
  customAllowancesOrTotal: SalaryCustomAllowanceRow[] | number | string | null | undefined = 0,
): EmployeeSalaryPackageBreakdown {
  const customAllowanceTotal = Array.isArray(customAllowancesOrTotal)
    ? sumSalaryCustomAllowances(customAllowancesOrTotal)
    : roundMoney2(Number(customAllowancesOrTotal ?? 0) || 0);
  const result = computeHrEmployeeSalaryPackage(employee, customAllowanceTotal);

  return {
    basicSalary: result.basicSalary.toNumber(),
    housingAllowance: result.housingAllowance.toNumber(),
    transportAllowance: result.transportAllowance.toNumber(),
    otherAllowance: result.otherAllowance.toNumber(),
    customAllowanceTotal: result.customAllowanceTotal.toNumber(),
    overtimeHoursPerDay: result.overtimeHoursPerDay,
    overtimePay: roundMoney2(result.overtimePay),
    fixedTotal: roundMoney2(result.fixedTotal),
    total: roundMoney2(result.total),
  };
}
export function employeeTargetTotalDecimal(
  employee: Record<string, unknown> | null | undefined,
  customTotal: unknown = 0,
  hoursVal?: unknown,
  workDaysVal?: unknown,
): Decimal {
  const hours = normalizeSalaryCalcHours(hoursVal ?? parseWorkHours(String(employee?.workHours ?? '')));
  const workDays = normalizeSalaryCalcDays(workDaysVal ?? parseOvertimeWorkDaysPerMonth(employee ?? {}));
  const employeeForCalc = {
    ...employee,
    workHours: String(hours),
    workSchedule: mergeOvertimeWorkDaysIntoSchedule(employee?.workSchedule || '', workDays),
  };

  return totalSalaryDecimal(employeeForCalc, customTotal);
}

export function computeSalaryCalculator(input: Record<string, unknown> = {}) {
  const hours = normalizeSalaryCalcHours(input.hoursPerDay);
  const workDays = normalizeSalaryCalcDays(input.daysPerMonth);
  const vacDays = parseFloat(String(input.vacationDays)) || 0;

  const totalTarget = salaryDecimal(input.targetTotal);
  const housing = salaryDecimal(input.housingAllowance);
  const transport = salaryDecimal(input.transportAllowance);
  const other = salaryDecimal(input.otherAllowance);
  const customAllowanceTotal = salaryDecimal(input.customAllowanceTotal);
  const editableAllowances = housing.plus(transport).plus(other);
  const totalAllowances = editableAllowances.plus(customAllowanceTotal);

  const empForInverse = {
    workHours: String(hours),
    workSchedule: mergeOvertimeWorkDaysIntoSchedule(input.workSchedule || '', workDays),
    housingAllowance: housing.toNumber(),
    transportAllowance: transport.toNumber(),
    otherAllowance: other.toNumber(),
  };

  const { basic: basicNum, inverseWarning } = totalTarget.gt(0)
    ? basicSalaryFromTargetTotalInclusiveOvertime(empForInverse, customAllowanceTotal.toNumber(), totalTarget.toNumber())
    : { basic: 0, inverseWarning: false };

  const basic = salaryDecimal(basicNum);
  const calcEmployee = {
    ...empForInverse,
    basicSalary: basic.toNumber(),
  };
  const overtime = overtimeBreakdownDecimal(calcEmployee, customAllowanceTotal);
  const actualWage = basic.plus(totalAllowances);
  const deduction = vacDays > 0 ? actualWage.times(vacDays).div(workDays) : new Decimal(0);
  const calculatedTotal = actualWage.plus(overtime.totalOTValue);
  const netSalary = calculatedTotal.minus(deduction);

  return {
    hours,
    workDays,
    vacDays,
    totalActualHours: hours * workDays,
    totalTarget,
    housing,
    transport,
    other,
    editableAllowances,
    customAllowanceTotal,
    totalAllowances,
    basic,
    inverseWarning,
    actualWage,
    deduction,
    calculatedTotal,
    netSalary,
    hourlyRate: overtime.actualHourlyRate,
    overtimeRate: overtime.overtimeHourlyRate,
    hasResult: totalTarget.gt(0) && basic.gt(0),
    hasOT: overtime.totalOT > 0,
    ...overtime,
  };
}
