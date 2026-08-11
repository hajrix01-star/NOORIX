import { Prisma } from '@prisma/client';
import {
  applyPayrollAdvanceSettlements,
  reversePayrollAdvanceSettlementsForDelete,
} from './hr-payroll-advance-settlement.util';

describe('payroll advance settlement selections', () => {
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
    };

    await applyPayrollAdvanceSettlements(
      db,
      {
        companyId: 'company-1',
        runNumber: 'PR-2608-001',
        payrollMonth: new Date('2026-08-01T00:00:00.000Z'),
        items: [
          {
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
  });

  it('recognizes historical reconciled deductions when reversing a payroll run', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const db = {
      invoice: { findFirst: jest.fn(), update: jest.fn() },
      employeeDeduction: { findMany, deleteMany },
      ledgerEntry: { updateMany },
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
    expect(deleteMany).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
