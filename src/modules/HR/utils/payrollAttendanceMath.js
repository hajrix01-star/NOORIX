/**
 * ربط مسيرة الراتب بمدة العمل في الشهر وبإجازات غير المدفوعة.
 * — تناسب تقويمي حسب تاريخ الالتحاق وتاريخ نهاية الخدمة (من ملاحظات الموظف).
 * — خصم أيام الإجازة المعتمدة من نوع unpaid فقط (السنوية/المرضية لا تُخصم آلياً).
 */
import { parseEmployeeNotesMeta } from './employeeNotesMeta';

/** مفاتيح أيام الإجازة التي تُخصم من الراتب في المسيرة */
export const LEAVE_TYPES_DEDUCT_SALARY = ['unpaid'];

export function monthRangeFromPayrollMonthStr(dateStr) {
  const start = new Date(dateStr);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const endCal = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  endCal.setHours(0, 0, 0, 0);
  return { monthStart: start, monthEndCal: endCal };
}

export function countInclusiveLocalDays(startDate, endDate) {
  const a = new Date(startDate);
  a.setHours(0, 0, 0, 0);
  const b = new Date(endDate);
  b.setHours(0, 0, 0, 0);
  if (b < a) return 0;
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

/** مفتاح يوم محلي YYYY-MM-DD (يتوافق مع عدّ أيام الإجازة في المسيرة) */
export function toLocalDayKey(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * عامل التناسب = أيام العمل (تقريباً) في الشهر / أيام الشهر التقويمية.
 * يعتمد على joinDate و(إن وُجد) terminationDate للموظف المفصول.
 */
export function getEmploymentProrationInMonth(employee, payrollMonthStr) {
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

  const join = new Date(employee.joinDate);
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

export function filterLeaveDaySetToEmploymentWindow(daySet, effectiveStart, effectiveEnd) {
  if (!effectiveStart || !effectiveEnd || effectiveStart > effectiveEnd) return new Set();
  const es = toLocalDayKey(effectiveStart);
  const ee = toLocalDayKey(effectiveEnd);
  const out = new Set();
  for (const k of daySet) {
    if (k >= es && k <= ee) out.add(k);
  }
  return out;
}
