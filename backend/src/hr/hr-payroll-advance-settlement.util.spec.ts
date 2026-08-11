import { Prisma } from '@prisma/client';
import {
  applyPayrollAdvanceSettlements,
  reversePayrollAdvanceSettlementsForDelete,
} from './hr-payroll-advance-settlement.util';

describe('payroll advance settlement selections', () => {
  it('registers multiple advances for one payroll item without posting extra expense entries', async () => {
    const advances = ['adv-1', 'adv-2'].map((id, index) => ({
      id,
      employeeId: 'emp-1',
      invoiceNumber: `ADV-00${index + 1}`,
      totalAmount: new Prisma.Decimal(100),
      settledAmount: new Prisma.Decimal(0),
      installmentAmount: new Prisma.Decimal(100),
      transactionDate: new Date('2026-07-01T00:00:00.000Z'),
      notes: null,
    }));
    const ledgerCreate = jest.fn();
    const registerCreate = jest.fn().mockResolvedValue({ id: 'settlement' });
    const db = {
      invoice: { findMany: jest.fn().mockResolvedValue(advances), update: jest.fn() },
      employeeDeduction: {
        create: jest.fn()
          .mockResolvedValueOnce({ id: 'deduction-1' })
          .mockResolvedValueOnce({ id: 'deduction-2' }),
      },
      account: { findFirst: jest.fn() },
      ledgerEntry: { create: ledgerCreate },
      payrollAdvanceSettlement: { create: registerCreate },
    };

    await applyPayrollAdvanceSettlements(db, {
      id: 'run-1', companyId: 'company-1', runNumber: 'PR-1',
      payrollMonth: new Date('2026-07-01T00:00:00.000Z'),
      items: [{
        id: 'item-1', employeeId: 'emp-1', advancesDeduct: new Prisma.Decimal(200),
        advanceSelections: [{ advanceId: 'adv-1', amount: 100 }, { advanceId: 'adv-2', amount: 100 }],
        employee: { name: 'Employee' },
      }],
    }, '2026-07-31', 'tenant-1', { postExpenseLedger: false });

    expect(ledgerCreate).not.toHaveBeenCalled();
    expect(registerCreate).toHaveBeenCalledTimes(2);
    expect(registerCreate.mock.calls.map((call) => call[0].data.idempotencyKey)).toEqual([
      'run-1:item-1:adv-1', 'run-1:item-1:adv-2',
    ]);
  });

  it('settles only the explicitly checked advance', async () => {
    const selectedAdvance = {
      id: 'adv-2',
      employeeId: 'emp-1',
      invoiceNumber: 'ADV-002',
      totalAmount: new Prisma.Decimal(800),
      settledAmount: new Prisma.Decimal(0),
      installmentAmount: new Prisma.Decimal(200),
      transactionDate: new Date('2026-07-15T00:00:00.000Z'),
      notes: null,
    };
    const findMany = jest.fn().mockResolvedValue([selectedAdvance]);
    const update = jest.fn().mockResolvedValue(selectedAdvance);
    const createDeduction = jest.fn().mockResolvedValue({ id: 'deduction-1' });
    const accountFindFirst = jest.fn()
      .mockResolvedValueOnce({ id: 'salary-expense' })
      .mockResolvedValueOnce({ id: 'advance-asset' });
    const createLedgerEntry = jest.fn().mockResolvedValue({ id: 'ledger-1' });
    const createSettlement = jest.fn().mockResolvedValue({ id: 'settlement-1' });
    const db = {
      invoice: {
        findMany,
        update,
      },
      employeeDeduction: {
        create: createDeduction,
      },
      account: { findFirst: accountFindFirst },
      ledgerEntry: { create: createLedgerEntry },
      payrollAdvanceSettlement: { create: createSettlement },
    };

    await applyPayrollAdvanceSettlements(
      db,
      {
        id: 'run-1',
        companyId: 'company-1',
        runNumber: 'PR-2608-001',
        payrollMonth: new Date('2026-08-01T00:00:00.000Z'),
        items: [
          {
            id: 'item-1',
            employeeId: 'emp-1',
            advancesDeduct: new Prisma.Decimal(125),
            advanceSelections: [{ advanceId: 'adv-2', amount: 125 }],
            employee: { name: 'Employee' },
          },
        ],
      },
      '2026-08-31',
      'tenant-1',
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['adv-2'] } }),
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'adv-2' } }),
    );
    expect(createDeduction).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referenceId: 'adv-2', amount: new Prisma.Decimal(125) }),
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'adv-2' },
        data: expect.objectContaining({ settledAmount: new Prisma.Decimal(125) }),
      }),
    );
    expect(createLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          debitAccountId: 'salary-expense',
          creditAccountId: 'advance-asset',
          referenceType: 'advance_settlement',
          referenceId: 'deduction-1',
        }),
      }),
    );
    expect(createSettlement).toHaveBeenCalledTimes(1);
    expect(createSettlement).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payrollRunId: 'run-1',
        payrollRunItemId: 'item-1',
        advanceInvoiceId: 'adv-2',
        deductionId: 'deduction-1',
        ledgerEntryId: 'ledger-1',
        idempotencyKey: 'run-1:item-1:adv-2',
      }),
    });
  });

  it('recognizes historical reconciled deductions when reversing a payroll run', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const db = {
      invoice: { findFirst: jest.fn(), update: jest.fn() },
      employeeDeduction: { findMany, deleteMany },
      ledgerEntry: { updateMany },
      payrollAdvanceSettlement: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    await reversePayrollAdvanceSettlementsForDelete(db, 'company-1', 'PR-2607-001');

    expect(findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        deductionType: 'advance',
        OR: [
          { notes: { contains: 'مسير PR-2607-001' } },
          { notes: { contains: '[PAYROLL_ADVANCE_RECONCILIATION] run=PR-2607-001,' } },
        ],
      },
    });
    expect(db.payrollAdvanceSettlement.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1', payrollRun: { runNumber: 'PR-2607-001' }, status: 'active' },
      data: { status: 'reversed', reversedAt: expect.any(Date) },
    });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
