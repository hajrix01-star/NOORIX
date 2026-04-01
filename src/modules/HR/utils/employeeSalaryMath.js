/**
 * ثوابت ومعادلات الراتب الشهري (متوافقة مع المادة 107 في الواجهة).
 *
 * المعيار: 8 ساعات/يوم. فوقها = أوفر تايم.
 * أيام ضرب الأوفر شهرياً تختلف حسب الاتفاق: غالباً 26 (شهر 30 ناقص ~4 أيام راحة)
 * أو 30 (دوام كامل الشهر) — تُخزَّن لكل موظف في workSchedule كـ [NOORIX_WD:26] أو :30.
 */
import Decimal from 'decimal.js';

export const SAUDI_STANDARD_HOURS = 8;
export const SAUDI_DAYS_PER_MONTH = 30;

/** افتراض عند عدم وجود وسوم: نمط «4 أيام إجازة بالشهر» ≈ 26 يوم عمل */
export const DEFAULT_OVERTIME_WORK_DAYS = 26;
/** اسم قديم للتوافق مع الاستيرادات */
export const WORK_DAYS_PER_MONTH = DEFAULT_OVERTIME_WORK_DAYS;

const NOORIX_WD_RE = /\[NOORIX_WD:(\d{1,2})\]/;

/** إزالة وسوم أيام الأوفر من نص نظام الدوام (للعرض في النماذج). */
export function stripOvertimeWorkDaysTag(schedule) {
  return String(schedule || '').replace(NOORIX_WD_RE, '').replace(/\s+/g, ' ').trim();
}

/** قراءة أيام العمل الشهرية المستخدمة في ضرب الأوفر تايم (1–31). */
export function parseOvertimeWorkDaysPerMonth(emp) {
  const sch = String(emp?.workSchedule || '');
  const m = sch.match(NOORIX_WD_RE);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) return Math.min(31, Math.max(1, n));
  }
  return DEFAULT_OVERTIME_WORK_DAYS;
}

const MAX_SCHEDULE_LEN = 120;

/** دمج نظام الدوام مع وسيم أيام الأوفر (يُستبدل الوسم السابق إن وُجد). */
export function mergeOvertimeWorkDaysIntoSchedule(schedule, days) {
  const d = Math.min(31, Math.max(1, Math.round(Number(days)) || DEFAULT_OVERTIME_WORK_DAYS));
  const tag = `[NOORIX_WD:${d}]`;
  let base = stripOvertimeWorkDaysTag(schedule);
  const maxBase = MAX_SCHEDULE_LEN - tag.length - (base ? 1 : 0);
  if (maxBase < 0) return tag.slice(0, MAX_SCHEDULE_LEN);
  if (base.length > maxBase) base = base.slice(0, maxBase).trim();
  const combined = base ? `${base} ${tag}`.trim() : tag;
  return combined.length > MAX_SCHEDULE_LEN ? combined.slice(0, MAX_SCHEDULE_LEN) : combined;
}

export function parseWorkHours(str) {
  if (!str) return SAUDI_STANDARD_HOURS;
  const m = String(str).match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, Math.min(12, parseFloat(m[1]))) : SAUDI_STANDARD_HOURS;
}

/** مجموع بدلات مخصصة لموظف من قائمة الـ API. */
export function sumCustomAllowancesForEmployee(allowanceRows, employeeId) {
  if (!employeeId || !Array.isArray(allowanceRows)) return 0;
  return allowanceRows
    .filter((row) => row.employeeId === employeeId)
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

/** أساسي + سكن + نقل + بدلات أخرى */
export function baseSalaryComponentsDecimal(emp) {
  return new Decimal(emp?.basicSalary ?? 0)
    .plus(emp?.housingAllowance ?? 0)
    .plus(emp?.transportAllowance ?? 0)
    .plus(emp?.otherAllowance ?? 0);
}

export function overtimePayDecimal(emp, customTotal = 0) {
  const workDays = parseOvertimeWorkDaysPerMonth(emp);
  const basic = new Decimal(emp?.basicSalary ?? 0);
  const housing = new Decimal(emp?.housingAllowance ?? 0);
  const transport = new Decimal(emp?.transportAllowance ?? 0);
  const other = new Decimal(emp?.otherAllowance ?? 0);
  const ct = new Decimal(customTotal || 0);
  const actualWage = basic.plus(housing).plus(transport).plus(other).plus(ct);
  const overtimeHoursPerDay = Math.max(0, parseWorkHours(emp?.workHours) - SAUDI_STANDARD_HOURS);
  if (overtimeHoursPerDay <= 0) return new Decimal(0);
  const actualHourlyRate = actualWage.div(SAUDI_DAYS_PER_MONTH).div(SAUDI_STANDARD_HOURS);
  const basicHourlyRate = basic.div(SAUDI_DAYS_PER_MONTH).div(SAUDI_STANDARD_HOURS);
  return actualHourlyRate
    .plus(basicHourlyRate.times(0.5))
    .times(overtimeHoursPerDay)
    .times(workDays);
}

export function overtimePay(emp, customTotal = 0) {
  return overtimePayDecimal(emp, customTotal).toNumber();
}

/** إجمالي شهري كما في ملف الموظف (يشمل تقدير الأوفر تايم). */
export function totalSalaryDecimal(emp, customTotal = 0) {
  return baseSalaryComponentsDecimal(emp)
    .plus(customTotal || 0)
    .plus(overtimePayDecimal(emp, customTotal));
}

export function totalSalary(emp, customTotal = 0) {
  return totalSalaryDecimal(emp, customTotal).toNumber();
}

/**
 * حزمة بدون أوفرتايم (أساسي + بدلات + مخصصة) — للمقارنة أو تقارير؛ المسيرة تستخدم totalSalary.
 */
export function fixedMonthlyPayPackageDecimal(emp, customTotal = 0) {
  return baseSalaryComponentsDecimal(emp).plus(customTotal || 0);
}

export function fixedMonthlyPayPackage(emp, customTotal = 0) {
  return fixedMonthlyPayPackageDecimal(emp, customTotal).toNumber();
}
