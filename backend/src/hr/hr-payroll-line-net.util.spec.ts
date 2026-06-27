import { computeHrPayrollLineNet } from './hr-payroll-line-net.util';

describe('hr payroll line net util', () => {
  it('computes payroll line net from one central formula', () => {
    expect(
      computeHrPayrollLineNet({
        grossSalary: 5000,
        allowancesAdd: 250,
        deductions: 100,
        advancesDeduct: 400,
      }),
    ).toBe(4750);
  });

  it('does not allow negative net salary', () => {
    expect(
      computeHrPayrollLineNet({
        grossSalary: 1000,
        allowancesAdd: 0,
        deductions: 200,
        advancesDeduct: 1500,
      }),
    ).toBe(0);
  });
});
