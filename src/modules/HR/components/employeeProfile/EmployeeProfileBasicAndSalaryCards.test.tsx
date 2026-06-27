import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { EmployeeProfileSalaryCard } from './EmployeeProfileBasicAndSalaryCards';

afterEach(() => {
  cleanup();
});

describe('EmployeeProfileSalaryCard', () => {
  it('renders centralized salary rows without crashing', () => {
    const t = (key: string) => key;
    const salaryRows = [
      { label: 'basicSalary', amount: 6000, strong: true },
      { label: 'housingAllowance', amount: 1000 },
      { label: 'salaryCalcOvertimePay', amount: 2687.5 },
      { label: 'totalSalary', amount: 10437.5, total: true },
    ];

    render(<EmployeeProfileSalaryCard t={t} salaryRows={salaryRows} total={10437.5} />);

    expect(screen.getByText('salaryBreakdown')).toBeTruthy();
    expect(screen.getAllByText('totalSalary').length).toBeGreaterThan(0);
    expect(screen.getByText('basicSalary')).toBeTruthy();
    expect(screen.getByText('salaryCalcOvertimePay')).toBeTruthy();
  });
});
