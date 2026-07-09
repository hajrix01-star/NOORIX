import { describe, expect, it } from 'vitest';

import { buildEmployeeProfileSummary, buildSalaryRows } from './employeeProfileModel';

const t = (key: string) => key;

describe('employeeProfileModel salary rows', () => {
  it('builds salary rows from the central package without caller-side math', () => {
    const rows = buildSalaryRows(
      {
        salaryPackage: {
          basicSalary: 6000,
          housingAllowance: 1000,
          transportAllowance: 500,
          otherAllowance: 0,
          customAllowanceTotal: 250,
          overtimeHoursPerDay: 2,
          overtimePay: 2687.5,
          fixedTotal: 7750,
          total: 10437.5,
        },
        customAllowances: {
          items: [{ nameAr: 'Field allowance', amount: '250' }],
        },
      },
      t,
    );

    expect(rows.map((row) => row.label)).toContain('basicSalary');
    expect(rows.map((row) => row.label)).toContain('Field allowance');
    expect(rows.find((row) => row.label === 'salaryCalcOvertimePay (2 h/day)')?.amount).toBe(2687.5);
    expect(rows.find((row) => row.total)?.amount).toBe(10437.5);
  });

  it('builds a profile summary from already-centralized backend values', () => {
    const summary = buildEmployeeProfileSummary({
      compensationSnapshot: {
        salaryPackage: {
          basicSalary: 6000,
          housingAllowance: 1000,
          transportAllowance: 500,
          otherAllowance: 0,
          customAllowanceTotal: 0,
          overtimeHoursPerDay: 0,
          overtimePay: 0,
          fixedTotal: 7500,
          total: 7500,
        },
      },
      advances: [{ remainingAmount: 300 }, { remainingAmount: 0 }],
      payrollItems: [{ id: 'payroll-1' }],
      leaves: [{ status: 'approved' }, { status: 'cancelled' }],
      residencies: [{ id: 'service-1' }],
      documents: [{ id: 'document-1' }, { id: 'document-2' }],
      careerTableRows: [{ typeLabel: 'raise', changeSummary: '1 -> 2', notes: '-', effectiveDate: '2026-01-01' }],
    });

    expect(summary.totalSalary).toBe(7500);
    expect(summary.activeAdvances).toBe(1);
    expect(summary.pendingAdvanceAmount).toBe(300);
    expect(summary.openLeaves).toBe(1);
    expect(summary.documents).toBe(2);
  });
});
