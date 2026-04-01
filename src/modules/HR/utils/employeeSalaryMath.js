/**
 * ثوابت ومعادلات الراتب الشهري (متوافقة مع المادة 107 في الواجهة).
 * الأوفر تايم: تقدير شهري بافتراض 26 يوم عمل؛ لا يُستخدم في حزمة المسيرة الافتراضية.
 */
import Decimal from 'decimal.js';

export const SAUDI_STANDARD_HOURS = 8;
export const SAUDI_DAYS_PER_MONTH = 30;
export const WORK_DAYS_PER_MONTH = 26;

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
    .times(WORK_DAYS_PER_MONTH);
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
 * حزمة الراتب الثابتة للمسيرة: بدون أوفرتايم (يُضاف شهرياً حسب العمل الفعلي).
 * = أساسي + بدلات الحقول + بدلات مخصصة.
 */
export function fixedMonthlyPayPackageDecimal(emp, customTotal = 0) {
  return baseSalaryComponentsDecimal(emp).plus(customTotal || 0);
}

export function fixedMonthlyPayPackage(emp, customTotal = 0) {
  return fixedMonthlyPayPackageDecimal(emp, customTotal).toNumber();
}
