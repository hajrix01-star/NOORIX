import { sumMonthlyPayrollForActiveEmployees } from './employee-monthly-payroll.util';

describe('employee monthly payroll util', () => {
  it('sums active employee packages through the central salary package utility', () => {
    const total = sumMonthlyPayrollForActiveEmployees(
      [
        {
          id: 'emp-1',
          basicSalary: 6000,
          housingAllowance: 1000,
          transportAllowance: 500,
          otherAllowance: 0,
          workHours: '10',
          workSchedule: '[NOORIX_WD:26]',
        },
        {
          id: 'emp-2',
          basicSalary: 3000,
          housingAllowance: 500,
          transportAllowance: 250,
          otherAllowance: 0,
          workHours: '8',
          workSchedule: '[NOORIX_WD:26]',
        },
      ],
      new Map([
        ['emp-1', 250],
        ['emp-2', 150],
      ]),
    );

    expect(total).toBe(14337.5);
  });
});
