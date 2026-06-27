import {
  computeHrEmployeeSalaryPackage,
  totalHrEmployeeSalaryPackageMonthly,
} from './employee-salary-package.util';

describe('employee salary package util', () => {
  it('computes the central backend salary package with custom allowances and overtime', () => {
    const employee = {
      basicSalary: 6000,
      housingAllowance: 1000,
      transportAllowance: 500,
      otherAllowance: 0,
      workHours: '10',
      workSchedule: '[NOORIX_WD:26]',
    };

    const packageBreakdown = computeHrEmployeeSalaryPackage(employee, 250);

    expect(packageBreakdown.fixedTotal.toNumber()).toBe(7750);
    expect(packageBreakdown.overtimeHoursPerDay).toBe(2);
    expect(packageBreakdown.overtimePay.toDecimalPlaces(2).toNumber()).toBe(2687.5);
    expect(totalHrEmployeeSalaryPackageMonthly(employee, 250)).toBe(10437.5);
  });
});
