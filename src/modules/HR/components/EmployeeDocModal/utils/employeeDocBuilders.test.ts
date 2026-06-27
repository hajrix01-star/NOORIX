import { describe, expect, it } from 'vitest';

import { buildSalaryRows, mapReasonByMeta } from './employeeDocBuilders';

describe('employee document termination reason mapping', () => {
  it('maps explicit legal clauses before free text', () => {
    expect(mapReasonByMeta('general termination', 'Article 80')).toBe('article80');
    expect(mapReasonByMeta('general termination', 'Article 81')).toBe('article81');
  });

  it('maps Arabic and English termination reasons for EOS settlement', () => {
    expect(mapReasonByMeta('استقالة الموظف')).toBe('resignation');
    expect(mapReasonByMeta('قوة قاهرة خارجة عن الإرادة')).toBe('force_majeure');
    expect(mapReasonByMeta('استقالة بعد الزواج أو الوضع')).toBe('maternity');
    expect(mapReasonByMeta('employee resignation')).toBe('resignation');
    expect(mapReasonByMeta('force majeure')).toBe('force_majeure');
    expect(mapReasonByMeta('maternity leave case')).toBe('maternity');
  });
});

describe('employee document salary rows', () => {
  const snapshot = {
    salaryPackage: {
      basicSalary: 6000,
      housingAllowance: 1000,
      transportAllowance: 500,
      otherAllowance: 0,
      overtimeHoursPerDay: 2,
      overtimePay: 2687.5,
      fixedTotal: 7750,
      total: 10437.5,
    },
    customAllowances: {
      items: [{ nameAr: 'Field allowance', nameEn: 'Field Allowance', amount: 250 }],
    },
  };

  it('uses the central compensation snapshot for document salary rows', () => {
    const { rows, total } = buildSalaryRows(snapshot);

    expect(total).toBe(10437.5);
    expect(rows.map((row) => row.en)).toContain('Field Allowance');
    expect(rows.find((row) => row.en.startsWith('Overtime Pay'))?.amount).toBe(2687.5);
  });

  it('does not fall back to local document salary math when the snapshot is missing', () => {
    expect(() => buildSalaryRows(null as any)).toThrow('HR compensation snapshot is required');
  });
});
