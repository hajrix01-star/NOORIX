/**
 * تقدير إجمالي الرواتب الشهرية للموظفين النشطين — نفس منطق الواجهة (employeeSalaryMath).
 */
import Decimal from 'decimal.js';
import type { Prisma } from '@prisma/client';

const SAUDI_STANDARD_HOURS = 8;
const SAUDI_WORK_DAYS_STANDARD = 26;
const DEFAULT_OVERTIME_WORK_DAYS = 26;
const NOORIX_WD_RE = /\[NOORIX_WD:(\d{1,2})\]/;

type ActiveEmployeePayRow = {
  id: string;
  basicSalary: Prisma.Decimal | number | string;
  housingAllowance: Prisma.Decimal | number | string;
  transportAllowance: Prisma.Decimal | number | string;
  otherAllowance: Prisma.Decimal | number | string;
  workHours: string | null;
  workSchedule: string | null;
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

function parseOvertimeWorkDaysPerMonth(emp: ActiveEmployeePayRow): number {
  const sch = String(emp.workSchedule || '');
  const m = sch.match(NOORIX_WD_RE);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) return Math.min(31, Math.max(1, n));
  }
  return DEFAULT_OVERTIME_WORK_DAYS;
}

function overtimePayDecimal(emp: ActiveEmployeePayRow, customTotal: number): Decimal {
  const workDays = parseOvertimeWorkDaysPerMonth(emp);
  const hours = parseWorkHours(emp.workHours);
  const basic = d(emp.basicSalary);
  const actual = basic
    .plus(emp.housingAllowance ?? 0)
    .plus(emp.transportAllowance ?? 0)
    .plus(emp.otherAllowance ?? 0)
    .plus(customTotal);

  const regularWorkDays = Math.min(workDays, SAUDI_WORK_DAYS_STANDARD);
  const restDays = Math.max(0, workDays - SAUDI_WORK_DAYS_STANDARD);
  const overtimeHoursPerDay = Math.max(0, hours - SAUDI_STANDARD_HOURS);

  const totalDailyOT = overtimeHoursPerDay * regularWorkDays;
  const totalRestOT = restDays * hours;
  const totalOT = totalDailyOT + totalRestOT;

  if (totalOT <= 0 || actual.lte(0)) return new Decimal(0);

  const overtimeHourlyRate = actual.plus(basic.times(0.5)).div(SAUDI_WORK_DAYS_STANDARD * SAUDI_STANDARD_HOURS);
  return overtimeHourlyRate.times(totalOT);
}

function totalSalaryDecimal(emp: ActiveEmployeePayRow, customTotal: number): Decimal {
  return d(emp.basicSalary)
    .plus(emp.housingAllowance ?? 0)
    .plus(emp.transportAllowance ?? 0)
    .plus(emp.otherAllowance ?? 0)
    .plus(customTotal)
    .plus(overtimePayDecimal(emp, customTotal));
}

/** مجموع الرواتب الشهرية التقديرية لقائمة موظفين نشطين */
export function sumMonthlyPayrollForActiveEmployees(
  employees: ActiveEmployeePayRow[],
  customAllowanceByEmployeeId: Map<string, number>,
): number {
  let sum = new Decimal(0);
  for (const emp of employees) {
    const custom = customAllowanceByEmployeeId.get(emp.id) ?? 0;
    sum = sum.plus(totalSalaryDecimal(emp, custom));
  }
  return Number(sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());
}
