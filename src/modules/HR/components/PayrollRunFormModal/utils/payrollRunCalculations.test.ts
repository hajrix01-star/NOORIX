import { describe, expect, it } from 'vitest';

import {
  buildAdvancesByEmployee,
  buildManualDeductionsByEmployee,
  buildPayrollLineForEmployee,
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
    const compensationSnapshotByEmployeeId = new Map([
      ['emp-1', { employeeId: 'emp-1', salaryPackage: { total: 10437.5 } }],
    ]);
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
      compensationSnapshotByEmployeeId,
      leaveDaysByEmployee: new Map(),
      settledDaysByEmployee: new Map(),
      advancesByEmployee,
      manualDeductionsByEmployee: new Map(),
      lang: 'en',
      t,
    });

    expect(line.grossSalary).toBe(10437.5);
    expect(line.advancesDeduct).toBe(600);
    expect(line.netSalary).toBe(9837.5);
    expect(line.employeeName).toBe('Test Employee');
  });

  it('adds same-month manual deductions to the payroll line', () => {
    const emp = {
      id: 'emp-1',
      name: 'Test Employee',
      joinDate: '2026-01-01',
      status: 'active',
    };
    const compensationSnapshotByEmployeeId = new Map([
      ['emp-1', { employeeId: 'emp-1', salaryPackage: { total: 5000 } }],
    ]);
    const manualDeductionsByEmployee = buildManualDeductionsByEmployee(
      [
        {
          employeeId: 'emp-1',
          deductionType: 'penalty',
          amount: '250',
          transactionDate: '2026-06-15T12:00:00.000Z',
        },
        {
          employeeId: 'emp-1',
          deductionType: 'other',
          amount: '100',
          transactionDate: '2026-07-01T12:00:00.000Z',
        },
      ],
      '2026-06',
    );

    const line = buildPayrollLineForEmployee({
      emp,
      payrollMonth: '2026-06',
      defaultMonth: '2026-06',
      compensationSnapshotByEmployeeId,
      leaveDaysByEmployee: new Map(),
      settledDaysByEmployee: new Map(),
      advancesByEmployee: new Map(),
      manualDeductionsByEmployee,
      lang: 'en',
      t,
    });

    expect(line.deductions).toBe(250);
    expect(line.netSalary).toBe(4750);
  });

  it('excludes advance deductions from manual payroll deductions', () => {
    const manualDeductionsByEmployee = buildManualDeductionsByEmployee(
      [
        {
          employeeId: 'emp-1',
          deductionType: 'advance',
          amount: '400',
          transactionDate: '2026-06-15T12:00:00.000Z',
        },
      ],
      '2026-06',
    );

    expect(manualDeductionsByEmployee.get('emp-1')).toBeUndefined();
  });
});
