/**
 * تسوية راتب تقويمية عند إجازة سنوية — يطابق totalSalary في الواجهة (أساسي + بدلات + أوفر تايم مُقدَّر).
 */
import Decimal from 'decimal.js';

const SAUDI_STANDARD_HOURS = 8;
const SAUDI_WORK_DAYS_STANDARD = 26;
const SAUDI_STANDARD_MONTHLY_HOURS = 208;

export type EmployeeSalaryShape = {
  basicSalary: unknown;
  housingAllowance?: unknown;
  transportAllowance?: unknown;
  otherAllowance?: unknown;
  workHours?: string | null;
  workSchedule?: string | null;
  joinDate: Date | string;
  status?: string | null;
  notes?: string | null;
};

function parseOvertimeWorkDaysPerMonth(emp: { workSchedule?: string | null }): number {
  const sch = String(emp?.workSchedule || '');
  const m = sch.match(/\[NOORIX_WD:(\d{1,2})\]/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) return Math.min(31, Math.max(1, n));
  }
  return SAUDI_WORK_DAYS_STANDARD;
}

function parseWorkHours(str: string | null | undefined): number {
  if (!str) return SAUDI_STANDARD_HOURS;
  const m = String(str).match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, Math.min(12, parseFloat(m[1]))) : SAUDI_STANDARD_HOURS;
}

function baseSalaryComponents(emp: EmployeeSalaryShape): Decimal {
  return new Decimal(String(emp.basicSalary ?? 0))
    .plus(String(emp.housingAllowance ?? 0))
    .plus(String(emp.transportAllowance ?? 0))
    .plus(String(emp.otherAllowance ?? 0));
}

function overtimePayDecimal(emp: EmployeeSalaryShape, customTotal: number): Decimal {
  const workDays = parseOvertimeWorkDaysPerMonth(emp);
  const hours = parseWorkHours(emp.workHours);
  const basic = new Decimal(String(emp.basicSalary ?? 0));
  const actual = basic
    .plus(String(emp.housingAllowance ?? 0))
    .plus(String(emp.transportAllowance ?? 0))
    .plus(String(emp.otherAllowance ?? 0))
    .plus(customTotal || 0);

  const regularWorkDays = Math.min(workDays, SAUDI_WORK_DAYS_STANDARD);
  const restDays = Math.max(0, workDays - SAUDI_WORK_DAYS_STANDARD);
  const overtimeHoursPerDay = Math.max(0, hours - SAUDI_STANDARD_HOURS);

  const totalDailyOT = overtimeHoursPerDay * regularWorkDays;
  const totalRestOT = restDays * hours;
  const totalOT = totalDailyOT + totalRestOT;

  if (totalOT <= 0 || actual.lte(0)) return new Decimal(0);

  const overtimeHourlyRate = actual.plus(basic.times(0.5)).div(SAUDI_STANDARD_MONTHLY_HOURS);
  return overtimeHourlyRate.times(totalOT);
}

/** إجمالي شهري كما في مسيرة الراتب (employeeSalaryMath.totalSalary). */
export function totalSalaryMonthly(emp: EmployeeSalaryShape, customTotal: number): number {
  return baseSalaryComponents(emp)
    .plus(customTotal || 0)
    .plus(overtimePayDecimal(emp, customTotal))
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
    .toNumber();
}

const HR_META = '[HR_META]';

export function parseTerminationDateFromNotes(notes: string | null | undefined): Date | null {
  const raw = String(notes || '');
  const idx = raw.lastIndexOf(HR_META);
  if (idx < 0) return null;
  try {
    const meta = JSON.parse(raw.slice(idx + HR_META.length).trim()) as { terminationDate?: string };
    const td = meta?.terminationDate;
    if (!td) return null;
    const d = new Date(td);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function countInclusiveCalendarDays(a: Date, b: Date): number {
  const da = new Date(a);
  da.setHours(0, 0, 0, 0);
  const db = new Date(b);
  db.setHours(0, 0, 0, 0);
  if (db < da) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86400000) + 1;
}

export type LeaveSalarySettlementCalc = {
  payrollMonth: Date;
  daysInMonth: number;
  calendarDaysPaid: number;
  grossAmount: number;
};

/**
 * راتب مستحق من أول الشهر حتى يوم بداية الإجازة (شامل) — مقسوم على أيام الشهر التقويمية.
 */
export function computeCalendarLeaveSalarySettlement(
  emp: EmployeeSalaryShape,
  leaveStartDate: Date,
  customAllowanceSum: number,
): LeaveSalarySettlementCalc {
  const start = new Date(leaveStartDate);
  start.setHours(0, 0, 0, 0);

  const payrollMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  payrollMonth.setHours(0, 0, 0, 0);

  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  monthEnd.setHours(0, 0, 0, 0);
  const daysInMonth = monthEnd.getDate();

  const monthStart = new Date(payrollMonth);

  const join = new Date(emp.joinDate);
  join.setHours(0, 0, 0, 0);
  const rangeStart = monthStart > join ? monthStart : join;

  let rangeEnd = new Date(start);
  if (rangeEnd > monthEnd) rangeEnd = monthEnd;

  if (emp.status === 'terminated') {
    const td = parseTerminationDateFromNotes(emp.notes);
    if (td) {
      const t = new Date(td);
      t.setHours(0, 0, 0, 0);
      if (t < rangeEnd) rangeEnd = t;
    }
  }

  if (rangeStart > rangeEnd) {
    return { payrollMonth, daysInMonth, calendarDaysPaid: 0, grossAmount: 0 };
  }

  const calendarDaysPaid = countInclusiveCalendarDays(rangeStart, rangeEnd);
  const factor = calendarDaysPaid / daysInMonth;
  const fullMonthly = totalSalaryMonthly(emp, customAllowanceSum);
  const grossAmount = Math.round(Math.max(0, fullMonthly * factor) * 100) / 100;

  return { payrollMonth, daysInMonth, calendarDaysPaid, grossAmount };
}
