import { describe, expect, it } from 'vitest';

import {
  buildAdvancesByEmployee,
  buildPayrollLineForEmployee,
  computeAllowanceTotals,
} from './payrollRunCalculations';

const t = (key: string, ...args: string[]) => `${key}:${args.join(',')}`;

describe('payrollRunCalculations smoke', () => {
  it('builds a payroll line using central salary package and advance balance helpers', () => {
    const emp = {
      id: 'emp-1',
      name: 'Test Employee',
      basicSalary: 6000,
      housingAllowance: 1000,
      transportAllowance: 500,
      otherAllowance: 0,
      workHours: '10',
      workSchedule: '[NOORIX_WD:26]',
      joinDate: '2026-01-01',
      status: 'active',
    };
    const allowanceTotals = computeAllowanceTotals([{ employeeId: 'emp-1', amount: '250' }]);
    const advancesByEmployee = buildAdvancesByEmployee(
      [
        {
          id: 'adv-1',
          employeeId: 'emp-1',
          status: 'partial',
          totalAmount: '1000',
          settledAmount: '400',
          transactionDate: '2026-06-03',
        },
      ],
      '2026-06',
    );

    const line = buildPayrollLineForEmployee({
      emp,
      payrollMonth: '2026-06',
      defaultMonth: '2026-06',
      allowanceTotals,
      leaveDaysByEmployee: new Map(),
      settledDaysByEmployee: new Map(),
      advancesByEmployee,
      lang: 'en',
      t,
    });

    expect(line.grossSalary).toBe(10437.5);
    expect(line.advancesDeduct).toBe(600);
    expect(line.netSalary).toBe(9837.5);
    expect(line.employeeName).toBe('Test Employee');
  });
});
