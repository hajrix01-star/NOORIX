import { BadRequestException } from '@nestjs/common';
import {
  assertPayrollItemsGrossMatchesCentralSnapshots,
  getPayrollEmploymentProrationFactor,
} from './hr-payroll-gross-source.util';

describe('hr-payroll-gross-source.util', () => {
  const payrollMonth = new Date('2026-06-01T00:00:00.000Z');
  const employee = {
    id: 'emp-1',
    joinDate: new Date('2026-01-01T00:00:00.000Z'),
    status: 'active',
    notes: '',
  };

  it('accepts payroll gross salary from the central monthly package snapshot', () => {
    expect(() =>
      assertPayrollItemsGrossMatchesCentralSnapshots({
        payrollMonth,
        items: [
          {
            employeeId: 'emp-1',
            grossSalary: 10437.5,
            netSalary: 10000,
          },
        ],
        employeesById: new Map([['emp-1', employee]]),
        snapshotByEmployeeId: new Map([
          ['emp-1', { employeeId: 'emp-1', salaryPackage: { total: 10437.5 } }],
        ]),
      }),
    ).not.toThrow();
  });

  it('rejects payroll gross salary that does not match the central snapshot', () => {
    expect(() =>
      assertPayrollItemsGrossMatchesCentralSnapshots({
        payrollMonth,
        items: [
          {
            employeeId: 'emp-1',
            grossSalary: 9000,
            netSalary: 9000,
          },
        ],
        employeesById: new Map([['emp-1', employee]]),
        snapshotByEmployeeId: new Map([
          ['emp-1', { employeeId: 'emp-1', salaryPackage: { total: 10437.5 } }],
        ]),
      }),
    ).toThrow(BadRequestException);
  });

  it('prorates gross salary for employees joining mid-month', () => {
    const factor = getPayrollEmploymentProrationFactor(
      {
        id: 'emp-2',
        joinDate: new Date('2026-06-16T00:00:00.000Z'),
        status: 'active',
        notes: '',
      },
      payrollMonth,
    );

    expect(factor).toBe(0.5);
  });
});
