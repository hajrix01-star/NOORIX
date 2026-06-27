import { describe, expect, it } from 'vitest';

import {
  computeTerminationSalarySettlementPreview,
  getTerminationPayrollMonthFirstDay,
} from './termination';

describe('hrCalculations/termination', () => {
  it('resolves the payroll month from the termination date', () => {
    expect(getTerminationPayrollMonthFirstDay('2026-06-17')).toBe('2026-06-01');
  });

  it('computes final salary settlement preview centrally', () => {
    const preview = computeTerminationSalarySettlementPreview({
      employee: {
        basicSalary: 3000,
        housingAllowance: 500,
        transportAllowance: 250,
        otherAllowance: 0,
        workHours: '8',
        workSchedule: '[NOORIX_WD:26]',
        joinDate: '2026-01-01',
        status: 'terminated',
        notes: '[HR_META]{"terminationDate":"2026-06-15"}',
      },
      terminationDate: '2026-06-15',
      monthlyPackageTotal: 3900,
      advancesRemaining: 300,
    });

    expect(preview?.payrollMonthFirstDay).toBe('2026-06-01');
    expect(preview?.fullMonthly).toBe(3900);
    expect(preview?.pr.employedDays).toBe(15);
    expect(preview?.pr.daysInMonth).toBe(30);
    expect(preview?.grossProrated).toBe(1950);
    expect(preview?.advancesRemaining).toBe(300);
    expect(preview?.netSuggested).toBe(1650);
  });

  it('does not allow negative suggested net after advances', () => {
    const preview = computeTerminationSalarySettlementPreview({
      employee: {
        basicSalary: 1000,
        joinDate: '2026-01-01',
        status: 'terminated',
        notes: '[HR_META]{"terminationDate":"2026-06-30"}',
      },
      terminationDate: '2026-06-30',
      monthlyPackageTotal: 1000,
      advancesRemaining: 5000,
    });

    expect(preview?.netSuggested).toBe(0);
  });

  it('uses the central salary package when overtime is part of the termination month', () => {
    const preview = computeTerminationSalarySettlementPreview({
      employee: {
        basicSalary: 6000,
        housingAllowance: 1000,
        transportAllowance: 500,
        otherAllowance: 0,
        workHours: '10',
        workSchedule: '[NOORIX_WD:26]',
        joinDate: '2026-01-01',
        status: 'terminated',
        notes: '[HR_META]{"terminationDate":"2026-06-30"}',
      },
      terminationDate: '2026-06-30',
      monthlyPackageTotal: 10437.5,
      advancesRemaining: 600,
    });

    expect(preview?.fullMonthly).toBe(10437.5);
    expect(preview?.grossProrated).toBe(10437.5);
    expect(preview?.netSuggested).toBe(9837.5);
  });
});
