import { Prisma } from '@prisma/client';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { applyPayrollAdvanceSettlements } from './hr-payroll-advance-settlement.util';
import {
  payrollAccrualDate,
  postPayrollAccrualInTransaction,
  type PayrollAccrualTx,
} from './hr-payroll-accrual.util';

jest.mock('./hr-payroll-advance-settlement.util', () => ({
  applyPayrollAdvanceSettlements: jest.fn(),
}));

describe('payroll accrual', () => {
  const run = {
    id: 'run-1',
    companyId: 'company-1',
    runNumber: 'PR-2026-07',
    payrollMonth: new Date('2026-07-01T00:00:00.000Z'),
    totalAmount: new Prisma.Decimal(800),
    items: [{
      employeeId: 'employee-1',
      netSalary: new Prisma.Decimal(800),
      advancesDeduct: new Prisma.Decimal(200),
      advanceSelections: [],
      employee: { name: 'Employee' },
    }],
  };

  it('uses the final calendar day of each payroll month', () => {
    expect(payrollAccrualDate(new Date('2026-02-01T00:00:00.000Z')).toISOString())
      .toBe('2026-02-28T00:00:00.000Z');
    expect(payrollAccrualDate(new Date('2028-02-01T00:00:00.000Z')).toISOString())
      .toBe('2028-02-29T00:00:00.000Z');
  });

  it('posts full payroll cost once and splits the credits between payable and advances', async () => {
    (applyPayrollAdvanceSettlements as jest.Mock).mockResolvedValue(new Prisma.Decimal(200));
    const tx = {
      ledgerEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      account: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ id: 'salary-expense' })
          .mockResolvedValueOnce({ id: 'payroll-payable' })
          .mockResolvedValueOnce({ id: 'advance-asset' }),
      },
    } as unknown as PayrollAccrualTx;
    const fiscal = Object.assign(Object.create(FiscalPeriodService.prototype), {
      assertPeriodOpenForDate: jest.fn().mockResolvedValue(undefined),
    }) as FiscalPeriodService;

    const result = await postPayrollAccrualInTransaction(tx, fiscal, run, 'tenant-1', 'user-1');

    expect(result.expense.toFixed(2)).toBe('1000.00');
    expect(applyPayrollAdvanceSettlements).toHaveBeenCalledWith(
      tx,
      run,
      '2026-07-31',
      'tenant-1',
      { postExpenseLedger: false },
    );
    expect(tx.ledgerEntry.create).toHaveBeenCalledTimes(2);
    expect(tx.ledgerEntry.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        debitAccountId: 'salary-expense',
        creditAccountId: 'payroll-payable',
        amount: new Prisma.Decimal(800),
        referenceType: 'payroll_accrual',
        reportingClass: 'operating_payroll',
      }),
    });
    expect(tx.ledgerEntry.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        debitAccountId: 'salary-expense',
        creditAccountId: 'advance-asset',
        amount: new Prisma.Decimal(200),
        referenceType: 'payroll_accrual',
        reportingClass: 'operating_payroll',
      }),
    });
  });

  it('is idempotent when an active payroll accrual already exists', async () => {
    const tx = {
      ledgerEntry: { findFirst: jest.fn().mockResolvedValue({ id: 'entry-1' }), create: jest.fn() },
      account: { findFirst: jest.fn() },
    } as unknown as PayrollAccrualTx;
    const fiscal = Object.assign(Object.create(FiscalPeriodService.prototype), {
      assertPeriodOpenForDate: jest.fn(),
    }) as FiscalPeriodService;

    const result = await postPayrollAccrualInTransaction(tx, fiscal, run, 'tenant-1');

    expect(result.idempotentReplay).toBe(true);
    expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
    expect(fiscal.assertPeriodOpenForDate).not.toHaveBeenCalled();
  });
});
