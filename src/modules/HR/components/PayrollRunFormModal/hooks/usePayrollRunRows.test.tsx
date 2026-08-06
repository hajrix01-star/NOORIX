import React, { useState } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppTestProviders } from '../../../../../test/appTestProviders';
import type { PayrollRunLineItem } from '../types';
import { usePayrollRunRows } from './usePayrollRunRows';

function salaryPackage(total: number) {
  return {
    basicSalary: total,
    housingAllowance: 0,
    transportAllowance: 0,
    otherAllowance: 0,
    customAllowanceTotal: 0,
    overtimeHoursPerDay: 0,
    overtimePay: 0,
    fixedTotal: total,
    total,
  };
}

describe('usePayrollRunRows', () => {
  it('initializes paid employees and safely excludes active employees with a zero salary', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppTestProviders>{children}</AppTestProviders>
    );

    const { result } = renderHook(() => {
      const [items, setItems] = useState<PayrollRunLineItem[]>([]);
      const rows = usePayrollRunRows({
        defaultMonth: '2026-07-01',
        payrollMonth: '2026-07-01',
        setPayrollMonth: () => undefined,
        setNotes: () => undefined,
        setItems,
        items,
        isEditMode: false,
        runId: null,
        employees: [
          { id: 'paid', nameAr: 'موظف براتب', status: 'active', joinDate: '2026-01-01' },
          { id: 'zero', nameAr: 'موظف بلا راتب', status: 'active', joinDate: '2026-01-01' },
        ],
        existingRuns: [],
        editingRun: undefined,
        monthStr: '2026-07',
        compensationSnapshotByEmployeeId: new Map([
          ['paid', { employeeId: 'paid', salaryPackage: salaryPackage(4050) }],
          ['zero', { employeeId: 'zero', salaryPackage: salaryPackage(0) }],
        ]),
        advances: [],
        deductions: [],
        leaves: [],
        leaveSalarySettlements: [],
      });
      return { items, rows };
    }, { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]).toEqual(expect.objectContaining({ employeeId: 'paid', grossSalary: 4050 }));
    expect(result.current.rows.excludedUnapprovedSalaryEmployeeIds).toEqual(['zero']);
    expect(result.current.rows.missingCentralSalaryEmployeeIds).toEqual([]);
  });
});
