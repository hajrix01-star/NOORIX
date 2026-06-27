import { describe, expect, it } from 'vitest';

import { buildSalaryRows } from './employeeProfileModel';

const t = (key: string) => key;

describe('employeeProfileModel salary rows', () => {
  it('builds salary rows from the central package without caller-side math', () => {
    const rows = buildSalaryRows(
      {
        basicSalary: 6000,
        housingAllowance: 1000,
        transportAllowance: 500,
        otherAllowance: 0,
        workHours: '10',
        workSchedule: '[NOORIX_WD:26]',
      },
      [{ nameAr: 'Field allowance', amount: '250' }],
      t,
    );

    expect(rows.map((row) => row.label)).toContain('basicSalary');
    expect(rows.map((row) => row.label)).toContain('Field allowance');
    expect(rows.find((row) => row.label === 'salaryCalcOvertimePay (2 ساعة/يوم)')?.amount).toBe(2687.5);
    expect(rows.find((row) => row.total)?.amount).toBe(10437.5);
  });
});
