import Decimal from 'decimal.js';

export const HR_SAUDI_STANDARD_HOURS = 8;
export const HR_SAUDI_WORK_DAYS_STANDARD = 26;
export const HR_SAUDI_DAYS_PER_MONTH = 30;
export const HR_SAUDI_STANDARD_MONTHLY_HOURS = HR_SAUDI_WORK_DAYS_STANDARD * HR_SAUDI_STANDARD_HOURS;
export const HR_DEFAULT_OVERTIME_WORK_DAYS = 26;

const NOORIX_WD_RE = /\[NOORIX_WD:(\d{1,2})\]/;
const MAX_SCHEDULE_LEN = 120;

export type HrEmployeeSalaryPackageInput = {
  [key: string]: unknown;
  basicSalary?: unknown;
  housingAllowance?: unknown;
  transportAllowance?: unknown;
  otherAllowance?: unknown;
  workHours?: unknown;
  workSchedule?: unknown;
};

export type HrCustomAllowanceAmountRow = {
  amount?: unknown;
};

export type HrPayrollLineNetInput = {
  grossSalary?: unknown;
  allowancesAdd?: unknown;
  deductions?: unknown;
  advancesDeduct?: unknown;
  netSalary?: unknown;
};

export type HrPayrollLineSummary = {
  grossSalary: number;
  allowancesAdd: number;
  beforeDeductions: number;
  payrollDeductions: number;
  advancesDeduct: number;
  totalDeductions: number;
  netSalary: number;
};

export type HrPayrollRunTotals = HrPayrollLineSummary;

export type HrEmployeeSalaryPackageBreakdown = {
  basicSalary: Decimal;
  housingAllowance: Decimal;
  transportAllowance: Decimal;
  otherAllowance: Decimal;
  customAllowanceTotal: Decimal;
  overtimeHoursPerDay: number;
  overtimePay: Decimal;
  fixedTotal: Decimal;
  total: Decimal;
};

function decimal(value: unknown): Decimal {
  if (value === null || value === undefined || value === '') return new Decimal(0);
  return new Decimal(String(value));
}

function toMoneyNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney2(value: Decimal.Value): number {
  return new Decimal(value || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function computeHrPayrollLineNet(input: HrPayrollLineNetInput): number {
  const gross = toMoneyNumber(input.grossSalary);
  const add = toMoneyNumber(input.allowancesAdd);
  const deductions = toMoneyNumber(input.deductions);
  const advances = toMoneyNumber(input.advancesDeduct);
  return roundMoney2(Decimal.max(new Decimal(gross).plus(add).minus(deductions).minus(advances), 0));
}

export function withComputedHrPayrollLineNet<T extends HrPayrollLineNetInput>(row: T): T & { netSalary: number } {
  return {
    ...row,
    netSalary: computeHrPayrollLineNet(row),
  };
}

export function computeHrPayrollLineSummary(input: HrPayrollLineNetInput): HrPayrollLineSummary {
  const grossSalary = toMoneyNumber(input.grossSalary);
  const allowancesAdd = toMoneyNumber(input.allowancesAdd);
  const payrollDeductions = toMoneyNumber(input.deductions);
  const advancesDeduct = toMoneyNumber(input.advancesDeduct);
  return {
    grossSalary,
    allowancesAdd,
    beforeDeductions: roundMoney2(new Decimal(grossSalary).plus(allowancesAdd)),
    payrollDeductions,
    advancesDeduct,
    totalDeductions: roundMoney2(new Decimal(payrollDeductions).plus(advancesDeduct)),
    netSalary: computeHrPayrollLineNet(input),
  };
}

export function computeHrPayrollRunTotals(lines: HrPayrollLineNetInput[] | null | undefined): HrPayrollRunTotals {
  const totals: HrPayrollRunTotals = {
    grossSalary: 0,
    allowancesAdd: 0,
    beforeDeductions: 0,
    payrollDeductions: 0,
    advancesDeduct: 0,
    totalDeductions: 0,
    netSalary: 0,
  };

  for (const line of lines ?? []) {
    const summary = computeHrPayrollLineSummary(line);
    totals.grossSalary += summary.grossSalary;
    totals.allowancesAdd += summary.allowancesAdd;
    totals.beforeDeductions += summary.beforeDeductions;
    totals.payrollDeductions += summary.payrollDeductions;
    totals.advancesDeduct += summary.advancesDeduct;
    totals.totalDeductions += summary.totalDeductions;
    totals.netSalary += summary.netSalary;
  }

  return {
    grossSalary: roundMoney2(totals.grossSalary),
    allowancesAdd: roundMoney2(totals.allowancesAdd),
    beforeDeductions: roundMoney2(totals.beforeDeductions),
    payrollDeductions: roundMoney2(totals.payrollDeductions),
    advancesDeduct: roundMoney2(totals.advancesDeduct),
    totalDeductions: roundMoney2(totals.totalDeductions),
    netSalary: roundMoney2(totals.netSalary),
  };
}

export function stripOvertimeWorkDaysTag(schedule: unknown): string {
  return String(schedule || '').replace(NOORIX_WD_RE, '').replace(/\s+/g, ' ').trim();
}

export function mergeOvertimeWorkDaysIntoSchedule(schedule: unknown, days: unknown): string {
  const d = Math.min(31, Math.max(1, Math.round(Number(days)) || HR_DEFAULT_OVERTIME_WORK_DAYS));
  const tag = `[NOORIX_WD:${d}]`;
  let base = stripOvertimeWorkDaysTag(schedule);
  const maxBase = MAX_SCHEDULE_LEN - tag.length - (base ? 1 : 0);
  if (maxBase < 0) return tag.slice(0, MAX_SCHEDULE_LEN);
  if (base.length > maxBase) base = base.slice(0, maxBase).trim();
  const combined = base ? `${base} ${tag}`.trim() : tag;
  return combined.length > MAX_SCHEDULE_LEN ? combined.slice(0, MAX_SCHEDULE_LEN) : combined;
}

export function sumHrCustomAllowanceAmounts(rows: HrCustomAllowanceAmountRow[] | null | undefined): number {
  const total = (rows ?? []).reduce((sum, row) => {
    const amount = Number(row?.amount ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  return roundMoney2(total);
}

export const sumSalaryCustomAllowances = sumHrCustomAllowanceAmounts;

export function parseHrEmployeeWorkHours(value: unknown): number {
  if (!value) return HR_SAUDI_STANDARD_HOURS;
  const match = String(value).match(/(\d+(?:\.\d+)?)/);
  return match ? Math.max(1, Math.min(12, parseFloat(match[1]))) : HR_SAUDI_STANDARD_HOURS;
}

export const parseWorkHours = parseHrEmployeeWorkHours;

export function parseHrEmployeeOvertimeWorkDaysPerMonth(emp: { workSchedule?: unknown } | null | undefined): number {
  const match = String(emp?.workSchedule || '').match(NOORIX_WD_RE);
  if (match) {
    const days = parseInt(match[1], 10);
    if (Number.isFinite(days)) return Math.min(31, Math.max(1, days));
  }
  return HR_DEFAULT_OVERTIME_WORK_DAYS;
}

export const parseOvertimeWorkDaysPerMonth = parseHrEmployeeOvertimeWorkDaysPerMonth;

export function computeHrEmployeeSalaryPackage(
  emp: HrEmployeeSalaryPackageInput | null | undefined,
  customAllowanceTotal: unknown = 0,
): HrEmployeeSalaryPackageBreakdown {
  const employee = emp ?? {};
  const basicSalary = decimal(employee.basicSalary);
  const housingAllowance = decimal(employee.housingAllowance);
  const transportAllowance = decimal(employee.transportAllowance);
  const otherAllowance = decimal(employee.otherAllowance);
  const customAllowance = decimal(customAllowanceTotal);
  const fixedTotal = basicSalary
    .plus(housingAllowance)
    .plus(transportAllowance)
    .plus(otherAllowance)
    .plus(customAllowance);

  const workDays = parseHrEmployeeOvertimeWorkDaysPerMonth(employee);
  const hours = parseHrEmployeeWorkHours(employee.workHours);
  const regularWorkDays = Math.min(workDays, HR_SAUDI_WORK_DAYS_STANDARD);
  const restDays = Math.max(0, workDays - HR_SAUDI_WORK_DAYS_STANDARD);
  const overtimeHoursPerDay = Math.max(0, hours - HR_SAUDI_STANDARD_HOURS);
  const totalDailyOvertime = overtimeHoursPerDay * regularWorkDays;
  const totalRestOvertime = restDays * hours;
  const totalOvertime = totalDailyOvertime + totalRestOvertime;
  const overtimePay =
    totalOvertime > 0 && fixedTotal.gt(0)
      ? fixedTotal.plus(basicSalary.times(0.5)).div(HR_SAUDI_STANDARD_MONTHLY_HOURS).times(totalOvertime)
      : new Decimal(0);

  return {
    basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowance,
    customAllowanceTotal: customAllowance,
    overtimeHoursPerDay,
    overtimePay,
    fixedTotal,
    total: fixedTotal.plus(overtimePay),
  };
}

export function totalHrEmployeeSalaryPackageMonthly(
  emp: HrEmployeeSalaryPackageInput | null | undefined,
  customAllowanceTotal: unknown = 0,
  decimalPlaces = 2,
): number {
  return computeHrEmployeeSalaryPackage(emp, customAllowanceTotal)
    .total
    .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function baseSalaryComponentsDecimal(emp: HrEmployeeSalaryPackageInput | null | undefined): Decimal {
  const result = computeHrEmployeeSalaryPackage(emp, 0);
  return result.basicSalary.plus(result.housingAllowance).plus(result.transportAllowance).plus(result.otherAllowance);
}

export function fixedMonthlyPayPackageDecimal(
  emp: HrEmployeeSalaryPackageInput | null | undefined,
  customTotal: unknown = 0,
): Decimal {
  return baseSalaryComponentsDecimal(emp).plus(decimal(customTotal));
}

export function fixedMonthlyPayPackage(emp: HrEmployeeSalaryPackageInput | null | undefined, customTotal: unknown = 0): number {
  return roundMoney2(fixedMonthlyPayPackageDecimal(emp, customTotal));
}

export function overtimePayDecimal(emp: HrEmployeeSalaryPackageInput | null | undefined, customTotal: unknown = 0): Decimal {
  return computeHrEmployeeSalaryPackage(emp, customTotal).overtimePay;
}

export function overtimePay(emp: HrEmployeeSalaryPackageInput | null | undefined, customTotal: unknown = 0): number {
  return roundMoney2(overtimePayDecimal(emp, customTotal));
}

export function totalSalaryDecimal(emp: HrEmployeeSalaryPackageInput | null | undefined, customTotal: unknown = 0): Decimal {
  return computeHrEmployeeSalaryPackage(emp, customTotal).total;
}

export function totalSalary(emp: HrEmployeeSalaryPackageInput | null | undefined, customTotal: unknown = 0): number {
  return roundMoney2(totalSalaryDecimal(emp, customTotal));
}

export function sumCustomAllowancesForEmployee(allowanceRows: Array<HrCustomAllowanceAmountRow & { employeeId?: unknown }> | null | undefined, employeeId: unknown): number {
  if (!employeeId || !Array.isArray(allowanceRows)) return 0;
  return sumHrCustomAllowanceAmounts(allowanceRows.filter((row) => row.employeeId === employeeId));
}

export function overtimeBreakdownDecimal(emp: HrEmployeeSalaryPackageInput | null | undefined, customTotal: unknown = 0) {
  const employee = emp ?? {};
  const workDays = parseHrEmployeeOvertimeWorkDaysPerMonth(employee);
  const hours = parseHrEmployeeWorkHours(employee.workHours);
  const basic = decimal(employee.basicSalary);
  const fixed = fixedMonthlyPayPackageDecimal(employee, customTotal);
  const regularWorkDays = Math.min(workDays, HR_SAUDI_WORK_DAYS_STANDARD);
  const restDays = Math.max(0, workDays - HR_SAUDI_WORK_DAYS_STANDARD);
  const overtimeHoursPerDay = Math.max(0, hours - HR_SAUDI_STANDARD_HOURS);
  const totalDailyOT = overtimeHoursPerDay * regularWorkDays;
  const totalRestOT = restDays * hours;
  const totalOT = totalDailyOT + totalRestOT;
  const standardHours = new Decimal(HR_SAUDI_STANDARD_MONTHLY_HOURS);
  const actualHourlyRate = fixed.gt(0) ? fixed.div(standardHours) : new Decimal(0);
  const basicHourlyRate = basic.gt(0) ? basic.div(standardHours) : new Decimal(0);
  const overtimeHourlyRate = actualHourlyRate.plus(basicHourlyRate.times(0.5));
  const dailyOTValue = overtimeHourlyRate.times(totalDailyOT);
  const restOTValue = overtimeHourlyRate.times(totalRestOT);
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

export function basicSalaryFromTargetTotalInclusiveOvertime(
  emp: HrEmployeeSalaryPackageInput | null | undefined,
  customTotal: unknown,
  targetTotal: unknown,
): { basic: number; inverseWarning: boolean } {
  const employee = emp ?? {};
  const totalTarget = decimal(targetTotal);
  const hours = Math.max(1, Math.min(12, parseHrEmployeeWorkHours(employee.workHours)));
  const workDays = Math.max(1, parseHrEmployeeOvertimeWorkDaysPerMonth(employee));
  const housing = decimal(employee.housingAllowance);
  const transport = decimal(employee.transportAllowance);
  const other = decimal(employee.otherAllowance);
  const custom = decimal(customTotal);
  const totalAllowances = housing.plus(transport).plus(other).plus(custom);
  const regularWorkDays = Math.min(workDays, HR_SAUDI_WORK_DAYS_STANDARD);
  const restDays = Math.max(0, workDays - HR_SAUDI_WORK_DAYS_STANDARD);
  const overtimeHoursPerDay = Math.max(0, hours - HR_SAUDI_STANDARD_HOURS);
  const totalDailyOT = overtimeHoursPerDay * regularWorkDays;
  const totalRestOT = restDays * hours;
  const totalOT = totalDailyOT + totalRestOT;

  if (totalOT === 0) {
    const basic = Decimal.max(totalTarget.minus(totalAllowances), 0);
    return {
      basic: roundMoney2(basic),
      inverseWarning: totalTarget.gt(0) && totalTarget.lte(totalAllowances) && totalAllowances.gt(0),
    };
  }

  const k = new Decimal(totalOT).div(HR_SAUDI_STANDARD_MONTHLY_HOURS);
  const numerator = totalTarget.minus(totalAllowances.times(new Decimal(1).plus(k)));
  const denominator = new Decimal(1).plus(new Decimal(1.5).times(k));
  const basic = Decimal.max(numerator.div(denominator), 0);
  return {
    basic: roundMoney2(basic),
    inverseWarning: totalTarget.gt(0) && numerator.lt(0),
  };
}
