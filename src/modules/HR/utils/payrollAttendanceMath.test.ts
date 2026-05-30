import { describe, expect, it } from 'vitest';
import {
  computeApprovedLeaveDaysByEmployee,
  computeSettledCalendarDayKeys,
  countPayrollPaidDaysInMonth,
} from './payrollAttendanceMath';

describe('payroll leave proration', () => {
  const employee = {
    id: 'e1',
    joinDate: '2025-01-01',
    status: 'active',
  };

  it('excludes employee on leave for the full month', () => {
    const leaves = [
      {
        employeeId: 'e1',
        status: 'approved',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      },
    ];
    const leaveDays = computeApprovedLeaveDaysByEmployee(leaves, '2025-01-01');
    const paid = countPayrollPaidDaysInMonth(employee, '2025-01-01', leaveDays, new Map());
    expect(paid.paidDays).toBe(0);
    expect(paid.leaveDays).toBe(31);
  });

  it('pays from return date when leave ends mid-month', () => {
    const leaves = [
      {
        employeeId: 'e1',
        status: 'approved',
        startDate: '2025-01-01',
        endDate: '2025-01-09',
      },
    ];
    const leaveDays = computeApprovedLeaveDaysByEmployee(leaves, '2025-01-01');
    const paid = countPayrollPaidDaysInMonth(employee, '2025-01-01', leaveDays, new Map());
    expect(paid.leaveDays).toBe(9);
    expect(paid.paidDays).toBe(22);
  });

  it('does not pay settled calendar days before annual leave travel', () => {
    const leaveDays = computeApprovedLeaveDaysByEmployee(
      [
        {
          employeeId: 'e1',
          status: 'approved',
          startDate: '2025-01-06',
          endDate: '2025-01-20',
        },
      ],
      '2025-01-01',
    );
    const settled = computeSettledCalendarDayKeys(employee, '2025-01-01', '2025-01-06');
    const settledMap = new Map([['e1', settled]]);
    const paid = countPayrollPaidDaysInMonth(employee, '2025-01-01', leaveDays, settledMap);
    expect(settled.size).toBe(6);
    expect(paid.settledDays).toBe(5);
    expect(paid.leaveDays).toBe(15);
    expect(paid.paidDays).toBe(11);
  });
});
