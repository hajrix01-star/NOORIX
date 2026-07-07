import { roundMoney, type DecimalInput } from '@noorix/finance-core';

/**
 * تسوية راتب تقويمية عند إجازة سنوية — تستخدم إجمالي الراتب الشهري المركزي.
 */

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

function money(value: DecimalInput): number {
  return roundMoney(value);
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

export function isPayableLeaveSalarySettlement(calc: LeaveSalarySettlementCalc): boolean {
  return calc.calendarDaysPaid > 0 && calc.grossAmount > 0;
}

export function resolveLeaveSalarySettlementGrossAmount(
  calc: LeaveSalarySettlementCalc,
  grossAmountOverride?: number | null,
): { grossAmount: number; hasManualOverride: boolean } {
  if (grossAmountOverride == null) {
    return { grossAmount: calc.grossAmount, hasManualOverride: false };
  }

  const override = Number(grossAmountOverride);
  if (!Number.isFinite(override) || override < 0.01) {
    throw new RangeError('Invalid leave salary settlement gross amount override.');
  }

  const grossAmount = roundMoney(override);
  return {
    grossAmount,
    hasManualOverride: Math.abs(grossAmount - calc.grossAmount) > 0.005,
  };
}

/**
 * راتب مستحق من أول الشهر حتى يوم بداية الإجازة (شامل) — مقسوم على أيام الشهر التقويمية.
 */
export function computeCalendarLeaveSalarySettlement(
  emp: EmployeeSalaryShape,
  leaveStartDate: Date,
  monthlyPackageTotal: number,
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
  const fullMonthly = money(monthlyPackageTotal);
  if (fullMonthly <= 0) {
    return { payrollMonth, daysInMonth, calendarDaysPaid, grossAmount: 0 };
  }
  const grossAmount = roundMoney(Math.max(0, fullMonthly * factor));

  return { payrollMonth, daysInMonth, calendarDaysPaid, grossAmount };
}
