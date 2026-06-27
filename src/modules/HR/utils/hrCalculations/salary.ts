/**
 * ثوابت ومعادلات الراتب الشهري — متوافقة مع نص المادة 107 من نظام العمل السعودي
 * ومع المرجع الرسمي لوزارة الموارد البشرية والتنمية الاجتماعية.
 *
 * نص المادة 107 الرسمي (بوابة وزارة الموارد البشرية):
 *   "يُدفع للعامل أجرٌ عن ساعات العمل الإضافية بأجر يوازي أجر الساعة
 *    مضافاً إليه (50%) من أجره الأساسي."
 *
 * التفسير القانوني:
 *   أجر_ساعة_OT = أجر_الساعة_الفعلي + 50% × أجر_الساعة_الأساسي
 *               = (فعلي + 0.5 × أساسي) ÷ 208
 *
 * حيث:
 *   - "أجر الساعة الفعلي"  = (أساسي + بدلات) ÷ 208   ← الأجر الكامل
 *   - "أجر الساعة الأساسي" = أساسي ÷ 208             ← الأساسي فقط للـ 50%
 *   - 208 ساعة = 26 يوم عمل × 8 ساعات (المعيار الرسمي م107)
 *
 * أيام > 26 تُعدّ «أيام راحة» — كامل ساعاتها تُحسب أوفر تايم.
 */
import Decimal from 'decimal.js';
import { roundMoney2 } from '../../../../utils/moneyInput';

export const SAUDI_STANDARD_HOURS = 8;
export const SAUDI_DAYS_PER_MONTH = 30;           // للحسابات اليومية العامة (نهاية خدمة، خصم إجازة)
export const SAUDI_WORK_DAYS_STANDARD = 26;       // أيام العمل المعيارية (م107 — 26 يوم)
export const SAUDI_STANDARD_MONTHLY_HOURS = SAUDI_WORK_DAYS_STANDARD * SAUDI_STANDARD_HOURS; // 208

/** افتراض عند عدم وجود وسوم: 26 يوم عمل شهرياً */
export const DEFAULT_OVERTIME_WORK_DAYS = 26;
/** اسم قديم للتوافق مع الاستيرادات */
export const WORK_DAYS_PER_MONTH = DEFAULT_OVERTIME_WORK_DAYS;

const NOORIX_WD_RE = /\[NOORIX_WD:(\d{1,2})\]/;

/** إزالة وسوم أيام الأوفر من نص نظام الدوام (للعرض في النماذج). */
export function stripOvertimeWorkDaysTag(schedule: any) {
  return String(schedule || '').replace(NOORIX_WD_RE, '').replace(/\s+/g, ' ').trim();
}

/** قراءة أيام العمل الشهرية المستخدمة في ضرب الأوفر تايم (1–31). */
export function parseOvertimeWorkDaysPerMonth(emp: any) {
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
export function mergeOvertimeWorkDaysIntoSchedule(schedule: any, days: any) {
  const d = Math.min(31, Math.max(1, Math.round(Number(days)) || DEFAULT_OVERTIME_WORK_DAYS));
  const tag = `[NOORIX_WD:${d}]`;
  let base = stripOvertimeWorkDaysTag(schedule);
  const maxBase = MAX_SCHEDULE_LEN - tag.length - (base ? 1 : 0);
  if (maxBase < 0) return tag.slice(0, MAX_SCHEDULE_LEN);
  if (base.length > maxBase) base = base.slice(0, maxBase).trim();
  const combined = base ? `${base} ${tag}`.trim() : tag;
  return combined.length > MAX_SCHEDULE_LEN ? combined.slice(0, MAX_SCHEDULE_LEN) : combined;
}

export function parseWorkHours(str: any) {
  if (!str) return SAUDI_STANDARD_HOURS;
  const m = String(str).match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, Math.min(12, parseFloat(m[1]))) : SAUDI_STANDARD_HOURS;
}

/** مجموع بدلات مخصصة لموظف من قائمة الـ API. */
export function sumCustomAllowancesForEmployee(allowanceRows: any, employeeId: any) {
  if (!employeeId || !Array.isArray(allowanceRows)) return 0;
  return sumSalaryCustomAllowances(allowanceRows.filter((row: any) => row.employeeId === employeeId));
}

/** أساسي + سكن + نقل + بدلات أخرى */
export function baseSalaryComponentsDecimal(emp: any) {
  return new Decimal(emp?.basicSalary ?? 0)
    .plus(emp?.housingAllowance ?? 0)
    .plus(emp?.transportAllowance ?? 0)
    .plus(emp?.otherAllowance ?? 0);
}

/**
 * حساب أوفر تايم الموظف الشهري وفق نص م107 الرسمي (وزارة الموارد البشرية):
 *
 *   أجر_ساعة_OT = (فعلي + 0.5 × أساسي) ÷ 208
 *
 * حيث "فعلي" = أساسي + بدلات (سكن + نقل + أخرى + مخصصة)
 *
 * أيام العمل الإجمالية مقسّمة إلى:
 *   - أيام عادية  (≤26): الساعات الزائدة عن 8 تُحسب OT
 *   - أيام الراحة (>26): كامل ساعاتها تُحسب OT
 */
export function overtimePayDecimal(emp: any, customTotal: any = 0) {
  const workDays = parseOvertimeWorkDaysPerMonth(emp);
  const hours    = parseWorkHours(emp?.workHours);
  const basic    = new Decimal(emp?.basicSalary ?? 0);
  const actual   = basic
    .plus(emp?.housingAllowance   ?? 0)
    .plus(emp?.transportAllowance ?? 0)
    .plus(emp?.otherAllowance     ?? 0)
    .plus(customTotal || 0);

  const regularWorkDays     = Math.min(workDays, SAUDI_WORK_DAYS_STANDARD);
  const restDays            = Math.max(0, workDays - SAUDI_WORK_DAYS_STANDARD);
  const overtimeHoursPerDay = Math.max(0, hours - SAUDI_STANDARD_HOURS);

  const totalDailyOT = overtimeHoursPerDay * regularWorkDays;
  const totalRestOT  = restDays * hours;
  const totalOT      = totalDailyOT + totalRestOT;

  if (totalOT <= 0 || actual.lte(0)) return new Decimal(0);

  // م107: أجر_ساعة_OT = أجر_الساعة_الفعلي + 50% × أجر_الساعة_الأساسي
  const overtimeHourlyRate = actual.plus(basic.times(0.5)).div(SAUDI_STANDARD_MONTHLY_HOURS);
  return overtimeHourlyRate.times(totalOT);
}

export function overtimePay(emp: any, customTotal: any = 0) {
  return roundMoney2(overtimePayDecimal(emp, customTotal).toNumber());
}

/** إجمالي شهري كما في ملف الموظف (يشمل تقدير الأوفر تايم). */
export type SalaryCustomAllowanceRow = {
  amount?: unknown;
};

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

export function sumSalaryCustomAllowances(rows: SalaryCustomAllowanceRow[] | null | undefined): number {
  const total = (rows ?? []).reduce((sum, row) => {
    const amount = Number(row?.amount ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  return roundMoney2(total);
}

export function computeEmployeeSalaryPackageBreakdown(
  employee: Record<string, unknown> | null | undefined,
  customAllowancesOrTotal: SalaryCustomAllowanceRow[] | number | string | null | undefined = 0,
): EmployeeSalaryPackageBreakdown {
  const customAllowanceTotal = Array.isArray(customAllowancesOrTotal)
    ? sumSalaryCustomAllowances(customAllowancesOrTotal)
    : roundMoney2(Number(customAllowancesOrTotal ?? 0) || 0);
  const basicSalary = roundMoney2(Number(employee?.basicSalary ?? 0) || 0);
  const housingAllowance = roundMoney2(Number(employee?.housingAllowance ?? 0) || 0);
  const transportAllowance = roundMoney2(Number(employee?.transportAllowance ?? 0) || 0);
  const otherAllowance = roundMoney2(Number(employee?.otherAllowance ?? 0) || 0);
  const overtimeHoursPerDay = Math.max(0, parseWorkHours(employee?.workHours) - SAUDI_STANDARD_HOURS);
  const overtimeAmount = overtimePay(employee, customAllowanceTotal);
  const fixedTotal = roundMoney2(
    basicSalary + housingAllowance + transportAllowance + otherAllowance + customAllowanceTotal,
  );
  const total = totalSalary(employee, customAllowanceTotal);

  return {
    basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowance,
    customAllowanceTotal,
    overtimeHoursPerDay,
    overtimePay: overtimeAmount,
    fixedTotal,
    total,
  };
}

export function totalSalaryDecimal(emp: any, customTotal: any = 0) {
  return baseSalaryComponentsDecimal(emp)
    .plus(customTotal || 0)
    .plus(overtimePayDecimal(emp, customTotal));
}

export function totalSalary(emp: any, customTotal: any = 0) {
  const d = totalSalaryDecimal(emp, customTotal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return roundMoney2(d.toString());
}

function salaryDecimal(value: any) {
  return new Decimal(value || 0);
}

function normalizeSalaryCalcHours(value: any) {
  return Math.max(1, Math.min(12, parseFloat(String(value)) || SAUDI_STANDARD_HOURS));
}

function normalizeSalaryCalcDays(value: any) {
  return Math.max(1, parseFloat(String(value)) || DEFAULT_OVERTIME_WORK_DAYS);
}

export function employeeTargetTotalDecimal(employee: any, customTotal: any = 0, hoursVal?: any, workDaysVal?: any) {
  const hours = normalizeSalaryCalcHours(hoursVal ?? parseWorkHours(employee?.workHours));
  const workDays = normalizeSalaryCalcDays(workDaysVal ?? parseOvertimeWorkDaysPerMonth(employee));
  const employeeForCalc = {
    ...employee,
    workHours: String(hours),
    workSchedule: mergeOvertimeWorkDaysIntoSchedule(employee?.workSchedule || '', workDays),
  };

  return totalSalaryDecimal(employeeForCalc, customTotal);
}

export function computeSalaryCalculator(input: any = {}) {
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

/**
 * حزمة بدون أوفرتايم (أساسي + بدلات + مخصصة) — للمقارنة أو تقارير.
 */
export function fixedMonthlyPayPackageDecimal(emp: any, customTotal: any = 0) {
  return baseSalaryComponentsDecimal(emp).plus(customTotal || 0);
}

export function fixedMonthlyPayPackage(emp: any, customTotal: any = 0) {
  return roundMoney2(fixedMonthlyPayPackageDecimal(emp, customTotal).toNumber());
}

/**
 * تفصيل الأوفر تايم الشهري (للعرض في الحاسبة).
 *
 * يُعيد:
 *   { regularWorkDays, restDays, overtimeHoursPerDay,
 *     totalDailyOT, totalRestOT, totalOT,
 *     actualHourlyRate, basicHourlyRate, overtimeHourlyRate,
 *     dailyOTValue, restOTValue, totalOTValue }
 *
 * القانون: أجر_ساعة_OT = أجر_الساعة_الفعلي + 50% × أجر_الساعة_الأساسي
 */
export function overtimeBreakdownDecimal(emp: any, customTotal: any = 0) {
  const workDays = parseOvertimeWorkDaysPerMonth(emp);
  const hours    = parseWorkHours(emp?.workHours);
  const basic    = new Decimal(emp?.basicSalary ?? 0);
  const actual   = basic
    .plus(emp?.housingAllowance   ?? 0)
    .plus(emp?.transportAllowance ?? 0)
    .plus(emp?.otherAllowance     ?? 0)
    .plus(customTotal || 0);

  const regularWorkDays     = Math.min(workDays, SAUDI_WORK_DAYS_STANDARD);
  const restDays            = Math.max(0, workDays - SAUDI_WORK_DAYS_STANDARD);
  const overtimeHoursPerDay = Math.max(0, hours - SAUDI_STANDARD_HOURS);

  const totalDailyOT = overtimeHoursPerDay * regularWorkDays;
  const totalRestOT  = restDays * hours;
  const totalOT      = totalDailyOT + totalRestOT;

  const H = new Decimal(SAUDI_STANDARD_MONTHLY_HOURS); // 208
  const actualHourlyRate  = actual.gt(0) ? actual.div(H) : new Decimal(0);
  const basicHourlyRate   = basic.gt(0)  ? basic.div(H)  : new Decimal(0);
  // م107: أجر_الساعة_الفعلي + 50% × أجر_الساعة_الأساسي
  const overtimeHourlyRate = actualHourlyRate.plus(basicHourlyRate.times(0.5));

  const dailyOTValue = overtimeHourlyRate.times(totalDailyOT);
  const restOTValue  = overtimeHourlyRate.times(totalRestOT);
  const totalOTValue = overtimeHourlyRate.times(totalOT);

  return {
    regularWorkDays,
    restDays,
    overtimeHoursPerDay,
    totalDailyOT,
    totalRestOT,
    totalOT,
    actualHourlyRate,
    basicHourlyRate,
    overtimeHourlyRate,
    dailyOTValue,
    restOTValue,
    totalOTValue,
  };
}

/**
 * عكس حاسبة الراتب: إيجاد الراتب الأساسي الذي يحقق إجمالياً شهرياً
 * (أساسي + بدلات + أوفر تايم) وفق نص م107 الرسمي:
 *
 *   الإجمالي = فعلي + H × [(فعلي + 0.5×أساسي) / 208]
 *   حيث فعلي = أساسي + بدلات ، K = H/208
 *
 *   الإجمالي = أساسي(1 + 1.5K) + بدلات(1 + K)
 *   → أساسي = [الإجمالي - بدلات(1+K)] ÷ (1 + 1.5K)
 *
 * @param {object}          emp          حقول الموظف
 * @param {number}          customTotal  مجموع البدلات المخصصة
 * @param {number|string|Decimal} targetTotal  الإجمالي الشهري المستهدف
 * @returns {{ basic: number, inverseWarning: boolean }}
 */
export function basicSalaryFromTargetTotalInclusiveOvertime(emp: any, customTotal: any, targetTotal: any) {
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

  if (totalOT === 0) {
    const basic = Decimal.max(totalTarget.minus(totalAllowances), 0);
    return {
      basic: roundMoney2(basic.toDecimalPlaces(2).toNumber()),
      inverseWarning: totalTarget.gt(0) && totalTarget.lte(totalAllowances) && totalAllowances.gt(0),
    };
  }

  // K = totalOT / 208
  const K = new Decimal(totalOT).div(SAUDI_STANDARD_MONTHLY_HOURS);

  // أساسي = [إجمالي - بدلات × (1 + K)] ÷ (1 + 1.5K)
  const numerator   = totalTarget.minus(totalAllowances.times(new Decimal(1).plus(K)));
  const denominator = new Decimal(1).plus(new Decimal(1.5).times(K));
  const basic       = Decimal.max(numerator.div(denominator), 0);
  const inverseWarning = totalTarget.gt(0) && numerator.lt(0);

  return {
    basic: roundMoney2(basic.toDecimalPlaces(2).toNumber()),
    inverseWarning,
  };
}
