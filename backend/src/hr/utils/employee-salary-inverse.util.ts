/**
 * استنتاج الراتب الأساسي من الإجمالي الشهري — مطابق لـ src/modules/HR/utils/employeeSalaryMath.ts
 */
import Decimal from 'decimal.js';
import type { Prisma } from '@prisma/client';

const SAUDI_STANDARD_HOURS = 8;
const SAUDI_WORK_DAYS_STANDARD = 26;
const SAUDI_STANDARD_MONTHLY_HOURS = SAUDI_WORK_DAYS_STANDARD * SAUDI_STANDARD_HOURS;
const DEFAULT_OVERTIME_WORK_DAYS = 26;
const NOORIX_WD_RE = /\[NOORIX_WD:(\d{1,2})\]/;

export type EmployeeSalaryRow = {
  basicSalary?: Prisma.Decimal | number | string | null;
  housingAllowance?: Prisma.Decimal | number | string | null;
  transportAllowance?: Prisma.Decimal | number | string | null;
  otherAllowance?: Prisma.Decimal | number | string | null;
  workHours?: string | null;
  workSchedule?: string | null;
};

function d(v: unknown): Decimal {
  if (v === null || v === undefined || v === '') return new Decimal(0);
  return new Decimal(String(v));
}

function parseWorkHours(str: string | null | undefined): number {
  if (!str) return SAUDI_STANDARD_HOURS;
  const m = String(str).match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, Math.min(12, parseFloat(m[1]))) : SAUDI_STANDARD_HOURS;
}

function parseOvertimeWorkDaysPerMonth(emp: EmployeeSalaryRow): number {
  const sch = String(emp.workSchedule || '');
  const m = sch.match(NOORIX_WD_RE);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) return Math.min(31, Math.max(1, n));
  }
  return DEFAULT_OVERTIME_WORK_DAYS;
}

export function basicSalaryFromTargetTotalInclusiveOvertime(
  emp: EmployeeSalaryRow,
  customTotal: number,
  targetTotal: number,
): { basic: number; inverseWarning: boolean } {
  const totalTarget = d(targetTotal);
  const hours = parseWorkHours(emp.workHours);
  const workDays = parseOvertimeWorkDaysPerMonth(emp);

  const housing = d(emp.housingAllowance);
  const transport = d(emp.transportAllowance);
  const other = d(emp.otherAllowance);
  const custom = d(customTotal);
  const totalAllowances = housing.plus(transport).plus(other).plus(custom);

  const regularWorkDays = Math.min(workDays, SAUDI_WORK_DAYS_STANDARD);
  const restDays = Math.max(0, workDays - SAUDI_WORK_DAYS_STANDARD);
  const overtimeHoursPerDay = Math.max(0, hours - SAUDI_STANDARD_HOURS);
  const totalDailyOT = overtimeHoursPerDay * regularWorkDays;
  const totalRestOT = restDays * hours;
  const totalOT = totalDailyOT + totalRestOT;

  if (totalOT === 0) {
    const basic = Decimal.max(totalTarget.minus(totalAllowances), 0);
    return {
      basic: Number(basic.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()),
      inverseWarning: totalTarget.gt(0) && totalTarget.lte(totalAllowances) && totalAllowances.gt(0),
    };
  }

  const K = new Decimal(totalOT).div(SAUDI_STANDARD_MONTHLY_HOURS);
  const numerator = totalTarget.minus(totalAllowances.times(new Decimal(1).plus(K)));
  const denominator = new Decimal(1).plus(new Decimal(1.5).times(K));
  const basic = Decimal.max(numerator.div(denominator), 0);
  const inverseWarning = totalTarget.gt(0) && numerator.lt(0);

  return {
    basic: Number(basic.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()),
    inverseWarning,
  };
}
