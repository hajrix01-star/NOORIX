/**
 * ثوابت ومعادلات الراتب الشهري (متوافقة مع المادة 107 في الواجهة).
 *
 * المعيار القانوني (م107): 8 ساعات/يوم، 26 يوم عمل/شهر → 208 ساعة معيارية.
 * 26 يوم = 30 يوماً - ~4 أيام راحة أسبوعية، وهو المعيار الرسمي المعتمد في
 * حاسبات نظام العمل السعودي لاحتساب أجر الساعة.
 *
 * أجر الساعة = الأساسي ÷ 208   (الأساسي فقط، البدلات لا تدخل في الأوفر تايم — م107)
 * أجر OT     = أجر الساعة × 1.5
 *
 * أيام > 26 تُعدّ «أيام راحة» — كامل ساعاتها تُحسب أوفر تايم.
 * أيام العمل تُخزَّن لكل موظف في workSchedule كـ [NOORIX_WD:26] أو :30 إلخ.
 */
import Decimal from 'decimal.js';

export const SAUDI_STANDARD_HOURS = 8;
export const SAUDI_DAYS_PER_MONTH = 30;           // للحسابات اليومية العامة (نهاية خدمة، خصم إجازة)
export const SAUDI_WORK_DAYS_STANDARD = 26;       // أيام العمل المعيارية (معيار نظام العمل م107)
export const SAUDI_STANDARD_MONTHLY_HOURS = SAUDI_WORK_DAYS_STANDARD * SAUDI_STANDARD_HOURS; // 208

/** افتراض عند عدم وجود وسوم: 26 يوم عمل شهرياً */
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

/**
 * حساب أوفر تايم الموظف الشهري وفق م107:
 *   أجر الساعة = الأساسي ÷ 208
 *   أجر OT     = أجر الساعة × 1.5
 *
 * أيام العمل الإجمالية مقسّمة إلى:
 *   - أيام عادية  (≤26): الساعات الزائدة عن 8 تُحسب OT
 *   - أيام الراحة (>26): كامل ساعاتها تُحسب OT
 */
export function overtimePayDecimal(emp, customTotal = 0) {
  const workDays = parseOvertimeWorkDaysPerMonth(emp);
  const hours    = parseWorkHours(emp?.workHours);
  const basic    = new Decimal(emp?.basicSalary ?? 0);

  const regularWorkDays     = Math.min(workDays, SAUDI_WORK_DAYS_STANDARD);
  const restDays            = Math.max(0, workDays - SAUDI_WORK_DAYS_STANDARD);
  const overtimeHoursPerDay = Math.max(0, hours - SAUDI_STANDARD_HOURS);

  const totalDailyOT = overtimeHoursPerDay * regularWorkDays;
  const totalRestOT  = restDays * hours;
  const totalOT      = totalDailyOT + totalRestOT;

  if (totalOT <= 0 || basic.lte(0)) return new Decimal(0);

  const hourlyRate   = basic.div(SAUDI_STANDARD_MONTHLY_HOURS); // أساسي / 208
  const overtimeRate = hourlyRate.times(1.5);
  return overtimeRate.times(totalOT);
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

/**
 * تفصيل الأوفر تايم الشهري (للعرض في الحاسبة).
 * يُعيد: { totalDailyOT, totalRestOT, totalOT, dailyOTValue, restOTValue, totalOTValue, hourlyRate, overtimeRate }
 */
export function overtimeBreakdownDecimal(emp, customTotal = 0) {
  const workDays = parseOvertimeWorkDaysPerMonth(emp);
  const hours    = parseWorkHours(emp?.workHours);
  const basic    = new Decimal(emp?.basicSalary ?? 0);

  const regularWorkDays     = Math.min(workDays, SAUDI_WORK_DAYS_STANDARD);
  const restDays            = Math.max(0, workDays - SAUDI_WORK_DAYS_STANDARD);
  const overtimeHoursPerDay = Math.max(0, hours - SAUDI_STANDARD_HOURS);

  const totalDailyOT = overtimeHoursPerDay * regularWorkDays;
  const totalRestOT  = restDays * hours;
  const totalOT      = totalDailyOT + totalRestOT;

  const hourlyRate   = basic.gt(0) ? basic.div(SAUDI_STANDARD_MONTHLY_HOURS) : new Decimal(0);
  const overtimeRate = hourlyRate.times(1.5);
  const dailyOTValue = overtimeRate.times(totalDailyOT);
  const restOTValue  = overtimeRate.times(totalRestOT);
  const totalOTValue = overtimeRate.times(totalOT);

  return { regularWorkDays, restDays, overtimeHoursPerDay, totalDailyOT, totalRestOT, totalOT, hourlyRate, overtimeRate, dailyOTValue, restOTValue, totalOTValue };
}

/**
 * عكس حاسبة الراتب: إيجاد الراتب الأساسي الذي يحقق إجمالياً شهرياً
 * (أساسي + بدلات + أوفر تايم) وفق م107:
 *
 *   الإجمالي = أساسي + بدلات + (أساسي/208 × 1.5 × إجمالي_ساعات_OT)
 *   → أساسي  = (الإجمالي − بدلات) ÷ (1 + 1.5 × OT_ساعات / 208)
 *
 * @param {object} emp       حقول الموظف (workHours, workSchedule, housingAllowance, transportAllowance, otherAllowance)
 * @param {number} customTotal  مجموع البدلات المخصصة
 * @param {number|string|Decimal} targetTotal  الإجمالي الشهري المستهدف (شامل الأوفر تايم)
 * @returns {{ basic: number, inverseWarning: boolean }}
 */
export function basicSalaryFromTargetTotalInclusiveOvertime(emp, customTotal, targetTotal) {
  const totalTarget = new Decimal(targetTotal || 0);
  const hours    = Math.max(1, Math.min(12, parseWorkHours(emp?.workHours)));
  const workDays = Math.max(1, parseOvertimeWorkDaysPerMonth(emp));

  const housing   = new Decimal(emp?.housingAllowance   ?? 0);
  const transport = new Decimal(emp?.transportAllowance ?? 0);
  const other     = new Decimal(emp?.otherAllowance     ?? 0);
  const custom    = new Decimal(customTotal || 0);
  const totalAllowances = housing.plus(transport).plus(other).plus(custom);

  const regularWorkDays     = Math.min(workDays, SAUDI_WORK_DAYS_STANDARD);
  const restDays            = Math.max(0, workDays - SAUDI_WORK_DAYS_STANDARD);
  const overtimeHoursPerDay = Math.max(0, hours - SAUDI_STANDARD_HOURS);
  const totalDailyOT        = overtimeHoursPerDay * regularWorkDays;
  const totalRestOT         = restDays * hours;
  const totalOT             = totalDailyOT + totalRestOT;

  // بدون أوفر تايم: الأساسي = الإجمالي − البدلات
  if (totalOT === 0) {
    const basic = Decimal.max(totalTarget.minus(totalAllowances), 0);
    return {
      basic: basic.toDecimalPlaces(2).toNumber(),
      inverseWarning: totalTarget.gt(0) && totalTarget.lte(totalAllowances) && totalAllowances.gt(0),
    };
  }

  // مع أوفر تايم: أساسي = (إجمالي − بدلات) ÷ (1 + 1.5 × OT / 208)
  const overtimeFactor = new Decimal(1.5).times(totalOT).div(SAUDI_STANDARD_MONTHLY_HOURS);
  const numerator      = totalTarget.minus(totalAllowances);
  const denominator    = new Decimal(1).plus(overtimeFactor);
  const basic          = Decimal.max(numerator.div(denominator), 0);
  const inverseWarning = totalTarget.gt(0) && numerator.lt(0);

  return {
    basic: basic.toDecimalPlaces(2).toNumber(),
    inverseWarning,
  };
}
