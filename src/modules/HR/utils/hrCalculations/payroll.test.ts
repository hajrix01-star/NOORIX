import { describe, expect, it } from 'vitest';

import { computePayrollLineNet, withComputedPayrollLineNet } from './payroll';

describe('hrCalculations/payroll', () => {
  it('computes payroll line net from one central formula', () => {
    expect(
      computePayrollLineNet({
        grossSalary: 5000,
        allowancesAdd: 250,
        deductions: 100,
        advancesDeduct: 400,
      }),
    ).toBe(4750);
  });

  it('does not allow negative net salary', () => {
    expect(
      computePayrollLineNet({
        grossSalary: 1000,
        allowancesAdd: 0,
        deductions: 200,
        advancesDeduct: 1500,
      }),
    ).toBe(0);
  });

  it('returns a row with recomputed net salary', () => {
    expect(
      withComputedPayrollLineNet({
        employeeId: 'emp-1',
        grossSalary: '2000',
        allowancesAdd: '50',
        deductions: '25',
        advancesDeduct: '10',
      }),
    ).toMatchObject({
      employeeId: 'emp-1',
      netSalary: 2015,
    });
  });
});
