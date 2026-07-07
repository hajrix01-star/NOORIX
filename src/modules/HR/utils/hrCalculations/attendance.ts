/**
 * ربط مسيرة الراتب بمدة العمل في الشهر وبإجازات الموظف.
 * — تناسب تقويمي حسب تاريخ الالتحاق وتاريخ نهاية الخدمة (من ملاحظات الموظف).
 * — أي يوم إجازة معتمدة لا يُحسب في المسيرة؛ الراتب من أيام العمل الفعلية فقط (مثلاً بعد العودة).
 * — أيام تسوية الراتب (إجازة سنوية) مُصرفة مسبقاً ولا تُكرَّر في المسيرة.
 */
import { parseEmployeeNotesMeta } from '../employeeNotesMeta';

export type PayrollLeaveRow = {
  employeeId?: string;
  status?: string;
  startDate?: string | Date;
  endDate?: string | Date;
};

export type PayrollLeaveSettlementRow = {
  employeeId?: string;
  leave?: { startDate?: string | Date };
};

type DateInput = unknown;
type PayrollEmployeeProrationSource = Record<string, unknown> & {
  joinDate?: DateInput;
  status?: string;
  notes?: unknown;
};

export function monthRangeFromPayrollMonthStr(dateStr: DateInput) {
  const start = new Date(dateStr as string | number | Date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const endCal = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  endCal.setHours(0, 0, 0, 0);
  return { monthStart: start, monthEndCal: endCal };
}

export function countInclusiveLocalDays(startDate: DateInput, endDate: DateInput) {
  const a = new Date(startDate as string | number | Date);
  a.setHours(0, 0, 0, 0);
  const b = new Date(endDate as string | number | Date);
  b.setHours(0, 0, 0, 0);
  if (b < a) return 0;
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

/** مفتاح يوم محلي YYYY-MM-DD (يتوافق مع عدّ أيام الإجازة في المسيرة) */
export function toLocalDayKey(d: DateInput) {
  const x = new Date(d as string | number | Date);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * عامل التناسب = أيام العمل (تقريباً) في الشهر / أيام الشهر التقويمية.
 * يعتمد على joinDate و(إن وُجد) terminationDate للموظف المفصول.
 */
export function getEmploymentProrationInMonth(employee: PayrollEmployeeProrationSource, payrollMonthStr: DateInput) {
  const { monthStart, monthEndCal } = monthRangeFromPayrollMonthStr(payrollMonthStr);
  const daysInMonth = countInclusiveLocalDays(monthStart, monthEndCal);
  if (daysInMonth <= 0) {
    return {
      factor: 0,
      employedDays: 0,
      daysInMonth: 0,
      effectiveStart: null,
      effectiveEnd: null,
    };
  }

  const join = new Date(employee.joinDate as string | number | Date);
  join.setHours(0, 0, 0, 0);
  let effectiveStart = join > monthStart ? join : monthStart;

  let effectiveEnd = monthEndCal;
  if (employee.status === 'terminated') {
    const { meta } = parseEmployeeNotesMeta(employee.notes);
    const td = meta?.terminationDate;
    if (td) {
      const t = new Date(td);
      t.setHours(0, 0, 0, 0);
      if (t < effectiveEnd) effectiveEnd = t;
    }
  }

  if (effectiveStart > effectiveEnd) {
    return {
      factor: 0,
      employedDays: 0,
      daysInMonth,
      effectiveStart,
      effectiveEnd,
    };
  }

  const employedDays = countInclusiveLocalDays(effectiveStart, effectiveEnd);
  const factor = Math.min(1, Math.max(0, employedDays / daysInMonth));
  return {
    factor,
    employedDays,
    daysInMonth,
    effectiveStart,
    effectiveEnd,
  };
}

export function filterLeaveDaySetToEmploymentWindow(daySet: Set<string>, effectiveStart: Date | null, effectiveEnd: Date | null) {
  if (!effectiveStart || !effectiveEnd || effectiveStart > effectiveEnd) return new Set();
  const es = toLocalDayKey(effectiveStart);
  const ee = toLocalDayKey(effectiveEnd);
  const out = new Set<string>();
  for (const k of daySet) {
    if (k >= es && k <= ee) out.add(k);
  }
  return out;
}

/** أيام الإجازة المعتمدة (كل الأنواع) لكل موظف داخل شهر المسيرة */
export function computeApprovedLeaveDaysByEmployee(
  leaves: PayrollLeaveRow[],
  payrollMonthStr: string,
): Map<string, Set<string>> {
  const { monthStart, monthEndCal } = monthRangeFromPayrollMonthStr(payrollMonthStr);
  const map = new Map<string, Set<string>>();
  for (const leave of leaves || []) {
    if (!leave?.employeeId || leave.status !== 'approved') continue;
    const leaveStart = new Date(leave.startDate as string);
    const leaveEnd = new Date(leave.endDate as string);
    const overlapStart = new Date(Math.max(leaveStart.getTime(), monthStart.getTime()));
    const overlapEnd = new Date(Math.min(leaveEnd.getTime(), monthEndCal.getTime()));
    if (overlapStart > overlapEnd) continue;
    const days = map.get(leave.employeeId) || new Set<string>();
    const cursor = new Date(overlapStart);
    cursor.setHours(0, 0, 0, 0);
    const overlapEndDay = new Date(overlapEnd);
    overlapEndDay.setHours(0, 0, 0, 0);
    while (cursor <= overlapEndDay) {
      days.add(toLocalDayKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    map.set(leave.employeeId, days);
  }
  return map;
}

/** أيام الشهر المُصرفة مسبقاً عبر تسوية راتب إجازة سنوية (من بداية الشهر/الالتحاق حتى يوم السفر) */
export function computeSettledCalendarDayKeys(
  employee: { joinDate?: unknown; status?: string; notes?: unknown },
  payrollMonthStr: string,
  leaveStartDate: string | Date,
): Set<string> {
  const { monthStart, monthEndCal } = monthRangeFromPayrollMonthStr(payrollMonthStr);
  const start = new Date(leaveStartDate);
  start.setHours(0, 0, 0, 0);
  const join = new Date(employee.joinDate as string);
  join.setHours(0, 0, 0, 0);
  let rangeStart = join > monthStart ? join : monthStart;
  let rangeEnd = start > monthEndCal ? monthEndCal : start;

  if (employee.status === 'terminated') {
    const { meta } = parseEmployeeNotesMeta(employee.notes);
    const td = meta?.terminationDate;
    if (td) {
      const t = new Date(td);
      t.setHours(0, 0, 0, 0);
      if (t < rangeEnd) rangeEnd = t;
    }
  }

  if (rangeStart > rangeEnd) return new Set();

  const keys = new Set<string>();
  const cursor = new Date(rangeStart);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    keys.add(toLocalDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

export function computeSettledDaysByEmployee(
  employees: Array<{ id?: string; joinDate?: unknown; status?: string; notes?: unknown }>,
  payrollMonthStr: string,
  settlements: PayrollLeaveSettlementRow[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const settlement of settlements || []) {
    if (!settlement?.employeeId || !settlement.leave?.startDate) continue;
    const emp = employees.find((e) => e.id === settlement.employeeId);
    if (!emp) continue;
    const keys = computeSettledCalendarDayKeys(emp, payrollMonthStr, settlement.leave.startDate);
    if (keys.size === 0) continue;
    map.set(settlement.employeeId, keys);
  }
  return map;
}

export type PayrollPaidDaysBreakdown = {
  paidDays: number;
  leaveDays: number;
  settledDays: number;
  daysInMonth: number;
  employedDays: number;
};

/** أيام الراتب المستحقة في المسيرة = أيام العمل في الشهر − إجازة − أيام مُصرفة بتسوية */
export function countPayrollPaidDaysInMonth(
  employee: { id?: string; joinDate?: unknown; status?: string; notes?: unknown },
  payrollMonthStr: string,
  leaveDaysByEmployee: Map<string, Set<string>>,
  settledDaysByEmployee: Map<string, Set<string>>,
): PayrollPaidDaysBreakdown {
  const pr = getEmploymentProrationInMonth(employee, payrollMonthStr);
  if (!pr.effectiveStart || !pr.effectiveEnd || pr.employedDays <= 0) {
    return {
      paidDays: 0,
      leaveDays: 0,
      settledDays: 0,
      daysInMonth: pr.daysInMonth,
      employedDays: 0,
    };
  }

  const leaveSet = filterLeaveDaySetToEmploymentWindow(
    leaveDaysByEmployee.get(employee.id as string) || new Set(),
    pr.effectiveStart,
    pr.effectiveEnd,
  );
  const settledSet = filterLeaveDaySetToEmploymentWindow(
    settledDaysByEmployee.get(employee.id as string) || new Set(),
    pr.effectiveStart,
    pr.effectiveEnd,
  );

  let paidDays = 0;
  let settledDays = 0;
  const cursor = new Date(pr.effectiveStart);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(pr.effectiveEnd);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const key = toLocalDayKey(cursor);
    if (leaveSet.has(key)) {
      // يوم إجازة — لا راتب
    } else if (settledSet.has(key)) {
      settledDays += 1;
    } else {
      paidDays += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    paidDays,
    leaveDays: leaveSet.size,
    settledDays,
    daysInMonth: pr.daysInMonth,
    employedDays: pr.employedDays,
  };
}
