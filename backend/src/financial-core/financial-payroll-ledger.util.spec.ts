import { Prisma } from '@prisma/client';
import {
  cancelProvenPayrollLegacyLedgerRowsInTransaction,
  cancelPayrollAccrualLedgerInTransaction,
  postPayrollAccrualLedgerInTransaction,
} from './financial-payroll-ledger.util';

describe('financial payroll ledger writer', () => {
  it('posts payroll accrual lines with the official reporting class', async () => {
    const tx = {
      ledgerEntry: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as Prisma.TransactionClient;

    await postPayrollAccrualLedgerInTransaction(tx, {
      tenantId: 'tenant-1',
      companyId: 'company-1',
      payrollRunId: 'run-1',
      salaryExpenseAccountId: 'expense-1',
      transactionDate: new Date('2026-07-31T00:00:00.000Z'),
      createdById: 'user-1',
      lines: [{
        employeeId: 'employee-1',
        creditAccountId: 'payable-1',
        amount: new Prisma.Decimal(800),
      }],
    });

    expect(tx.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        debitAccountId: 'expense-1',
        creditAccountId: 'payable-1',
        amount: new Prisma.Decimal(800),
        referenceType: 'payroll_accrual',
        referenceId: 'run-1',
        reportingClass: 'operating_payroll',
      }),
    });
  });

  it('cancels only the active accrual for the selected company and run', async () => {
    const tx = {
      ledgerEntry: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    } as unknown as Prisma.TransactionClient;

    await cancelPayrollAccrualLedgerInTransaction(tx, 'company-1', 'run-1');

    expect(tx.ledgerEntry.updateMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        referenceType: 'payroll_accrual',
        referenceId: 'run-1',
        status: 'active',
      },
      data: { status: 'cancelled' },
    });
  });

  it('cancels only proven non-cash legacy payroll rows inside the accounting writer', async () => {
    const tx = {
      ledgerEntry: { updateMany: jest.fn().mockResolvedValue({ count: 27 }) },
    } as unknown as Prisma.TransactionClient;

    await cancelProvenPayrollLegacyLedgerRowsInTransaction(
      tx,
      'company-1',
      ['legacy-1', 'legacy-2'],
    );

    expect(tx.ledgerEntry.updateMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        id: { in: ['legacy-1', 'legacy-2'] },
        status: 'active',
        referenceType: 'advance_settlement',
        vaultId: null,
        debitAccount: { code: 'EXP-004' },
        creditAccount: { code: 'ADV-001' },
      },
      data: { status: 'cancelled' },
    });
  });
});
