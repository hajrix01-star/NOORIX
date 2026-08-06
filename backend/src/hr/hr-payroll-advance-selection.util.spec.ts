import { assertPayrollAdvanceSelections } from './hr-payroll-advance-selection.util';

describe('payroll advance selection validation', () => {
  const payrollMonth = new Date('2026-08-01T00:00:00.000Z');

  function dbWith(advances: Array<Record<string, unknown>>) {
    return {
      invoice: {
        findMany: jest.fn().mockResolvedValue(advances),
      },
    };
  }

  it('accepts the central installment and accepts an explicit empty selection as deferral', async () => {
    const db = dbWith([
      {
        id: 'adv-1',
        companyId: 'company-1',
        employeeId: 'emp-1',
        invoiceNumber: 'ADV-001',
        totalAmount: 1000,
        settledAmount: 200,
        installmentAmount: 250,
        status: 'active',
        notes: null,
      },
    ]);

    await expect(
      assertPayrollAdvanceSelections(db, 'company-1', payrollMonth, [
        {
          employeeId: 'emp-1',
          grossSalary: 5000,
          advancesDeduct: 250,
          advanceSelections: [{ advanceId: 'adv-1', amount: 250 }],
          netSalary: 4750,
        },
        {
          employeeId: 'emp-2',
          grossSalary: 4000,
          advancesDeduct: 0,
          advanceSelections: [],
          netSalary: 4000,
        },
      ]),
    ).resolves.toBeUndefined();
  });

  it('accepts a partial deduction for this run without changing the central installment', async () => {
    const db = dbWith([
      {
        id: 'adv-1',
        employeeId: 'emp-1',
        invoiceNumber: 'ADV-001',
        totalAmount: 1000,
        settledAmount: 0,
        installmentAmount: 250,
        status: 'active',
        notes: null,
      },
    ]);

    await expect(
      assertPayrollAdvanceSelections(db, 'company-1', payrollMonth, [
        {
          employeeId: 'emp-1',
          grossSalary: 5000,
          advancesDeduct: 200,
          advanceSelections: [{ advanceId: 'adv-1', amount: 200 }],
          netSalary: 4800,
        },
      ]),
    ).resolves.toBeUndefined();
  });

  it('rejects a deduction that exceeds the live remaining balance', async () => {
    const db = dbWith([
      {
        id: 'adv-1',
        employeeId: 'emp-1',
        invoiceNumber: 'ADV-001',
        totalAmount: 1000,
        settledAmount: 800,
        installmentAmount: 250,
        status: 'active',
        notes: null,
      },
    ]);

    await expect(
      assertPayrollAdvanceSelections(db, 'company-1', payrollMonth, [
        {
          employeeId: 'emp-1',
          grossSalary: 5000,
          advancesDeduct: 250,
          advanceSelections: [{ advanceId: 'adv-1', amount: 250 }],
          netSalary: 4750,
        },
      ]),
    ).rejects.toThrow('تتجاوز الرصيد المتبقي');
  });
});
