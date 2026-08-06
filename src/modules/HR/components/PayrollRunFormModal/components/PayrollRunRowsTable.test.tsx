import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PayrollRunRowsTable } from './PayrollRunRowsTable';
import type { PayrollRunLineItem } from '../types';

afterEach(cleanup);

const item: PayrollRunLineItem = {
  employeeId: 'emp-1',
  employeeName: 'Employee',
  grossSalary: 3000,
  allowancesAdd: 0,
  deductions: 0,
  advancesDeduct: 500,
  netSalary: 2500,
  deferAdvances: false,
  advanceDates: '31/03/2026',
  advanceChoices: [{
    advanceId: 'adv-1',
    invoiceNumber: 'ADV-001',
    transactionDate: '2026-03-31',
    dateLabel: '31/03/2026',
    amount: 500,
    remaining: 1400,
    selected: true,
  }],
  notes: undefined,
};

describe('PayrollRunRowsTable advance deduction amount', () => {
  it('renders a compact editable amount and reports a partial deduction', () => {
    const updateAdvanceAmount = vi.fn();
    render(
      <PayrollRunRowsTable
        displayEmployees={[{ id: 'emp-1', name: 'Employee' }]}
        items={[item]}
        lang="en"
        t={(key) => key}
        updateItem={vi.fn()}
        toggleInclude={vi.fn()}
        toggleAdvance={vi.fn()}
        updateAdvanceAmount={updateAdvanceAmount}
        selectInput={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', {
      name: 'payrollAdvanceDeductionAmount 31/03',
    }));
    const amountInput = screen.getByRole('spinbutton', {
      name: 'payrollAdvanceDeductionAmount 31/03',
    });
    expect(amountInput.getAttribute('max')).toBe('1400');
    fireEvent.change(amountInput, { target: { value: '200' } });
    fireEvent.blur(amountInput);
    expect(updateAdvanceAmount).toHaveBeenCalledWith('emp-1', 'adv-1', '200');
  });
});
