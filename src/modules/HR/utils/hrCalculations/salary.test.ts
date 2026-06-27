import { describe, expect, it } from 'vitest';

import {
  computeEmployeeSalaryPackageBreakdown,
  computeSalaryCalculator,
  employeeTargetTotalDecimal,
  mergeOvertimeWorkDaysIntoSchedule,
  sumSalaryCustomAllowances,
} from './salary';

describe('hrCalculations/salary', () => {
  it('computes a target package without overtime', () => {
    const result = computeSalaryCalculator({
      targetTotal: 7000,
      hoursPerDay: 8,
      daysPerMonth: 26,
      housingAllowance: 1000,
      transportAllowance: 500,
      otherAllowance: 0,
    });

    expect(result.hasOT).toBe(false);
    expect(result.basic.toNumber()).toBe(5500);
    expect(result.totalAllowances.toNumber()).toBe(1500);
    expect(result.calculatedTotal.toNumber()).toBe(7000);
  });

  it('keeps the inverse salary total aligned when daily overtime exists', () => {
    const result = computeSalaryCalculator({
      targetTotal: 10000,
      hoursPerDay: 10,
      daysPerMonth: 26,
      housingAllowance: 1000,
    });

    expect(result.totalDailyOT).toBe(52);
    expect(result.totalRestOT).toBe(0);
    expect(result.hasOT).toBe(true);
    expect(result.calculatedTotal.toNumber()).toBeCloseTo(10000, 2);
  });

  it('counts days above 26 as rest-day overtime', () => {
    const result = computeSalaryCalculator({
      targetTotal: 10000,
      hoursPerDay: 8,
      daysPerMonth: 30,
    });

    expect(result.totalDailyOT).toBe(0);
    expect(result.totalRestOT).toBe(32);
    expect(result.totalOT).toBe(32);
    expect(result.calculatedTotal.toNumber()).toBeCloseTo(10000, 2);
  });

  it('includes custom allowances in the inverse salary calculation', () => {
    const result = computeSalaryCalculator({
      targetTotal: 8000,
      hoursPerDay: 8,
      daysPerMonth: 26,
      housingAllowance: 700,
      customAllowanceTotal: 300,
    });

    expect(result.basic.toNumber()).toBe(7000);
    expect(result.totalAllowances.toNumber()).toBe(1000);
    expect(result.calculatedTotal.toNumber()).toBe(8000);
  });

  it('warns when the target total cannot cover allowances', () => {
    const result = computeSalaryCalculator({
      targetTotal: 500,
      hoursPerDay: 8,
      daysPerMonth: 26,
      housingAllowance: 1000,
    });

    expect(result.inverseWarning).toBe(true);
    expect(result.basic.toNumber()).toBe(0);
    expect(result.hasResult).toBe(false);
  });

  it('deducts vacation days from the fixed wage package', () => {
    const result = computeSalaryCalculator({
      targetTotal: 7000,
      hoursPerDay: 8,
      daysPerMonth: 26,
      vacationDays: 2,
      housingAllowance: 1000,
      transportAllowance: 500,
    });

    expect(result.deduction.toNumber()).toBeCloseTo(538.4615, 4);
    expect(result.netSalary.toNumber()).toBeCloseTo(6461.5385, 4);
  });

  it('uses the same central total for employee option previews', () => {
    const workSchedule = mergeOvertimeWorkDaysIntoSchedule('Day shift', 30);
    const total = employeeTargetTotalDecimal(
      {
        basicSalary: 6000,
        housingAllowance: 1000,
        transportAllowance: 500,
        otherAllowance: 0,
        workHours: '8',
        workSchedule,
      },
      250,
    );

    expect(total.toNumber()).toBeCloseTo(9403.8462, 4);
  });

  it('builds an employee salary package breakdown from the central salary source', () => {
    const breakdown = computeEmployeeSalaryPackageBreakdown(
      {
        basicSalary: 6000,
        housingAllowance: 1000,
        transportAllowance: 500,
        otherAllowance: 0,
        workHours: '10',
        workSchedule: mergeOvertimeWorkDaysIntoSchedule('Day shift', 26),
      },
      [{ amount: '250' }, { amount: 'bad' }],
    );

    expect(sumSalaryCustomAllowances([{ amount: '100.50' }, { amount: 50 }, { amount: 'bad' }])).toBe(150.5);
    expect(breakdown.customAllowanceTotal).toBe(250);
    expect(breakdown.overtimeHoursPerDay).toBe(2);
    expect(breakdown.fixedTotal).toBe(7750);
    expect(breakdown.total).toBeCloseTo(10437.5, 2);
  });
});
