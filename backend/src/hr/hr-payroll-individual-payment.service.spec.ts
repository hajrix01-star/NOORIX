import { Prisma } from '@prisma/client';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { HrPayrollIndividualPaymentService } from './hr-payroll-individual-payment.service';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { postPayrollAccrualInTransaction } from './hr-payroll-accrual.util';

jest.mock('./hr-payroll-accrual.util', () => ({
  postPayrollAccrualInTransaction: jest.fn().mockResolvedValue({
    expense: new Prisma.Decimal(1700), payable: new Prisma.Decimal(1700), advances: new Prisma.Decimal(0), idempotentReplay: false,
  }),
}));

jest.mock('../common/tenant-context', () => ({
  TenantContext: { getTenantId: jest.fn(() => 'tenant-1') },
}));

describe('HrPayrollIndividualPaymentService', () => {
  beforeEach(() => jest.clearAllMocks());
  const payload = {
    companyId: 'company-1', employeeId: 'employee-1', payrollMonth: '2026-07-01', amount: 1700,
    vaultId: 'vault-1', transactionDate: '2026-07-31', idempotencyKey: 'try-1',
  };

  function makePrisma(existingRun: object | null = null, existingInvoice: object | null = null) {
    const tx = {
      employee: { findFirst: jest.fn().mockResolvedValue({ id: 'employee-1', name: 'Mohammed' }) },
      vault: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'vault-1', nameAr: 'Main vault', isActive: true, isArchived: false, showAsPaymentMethod: true,
        }]),
      },
      account: { findFirst: jest.fn().mockResolvedValue({ id: 'payroll-payable' }) },
      payrollRun: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(existingRun),
        create: jest.fn().mockResolvedValue({
          id: 'supplementary-run-1', companyId: 'company-1', runNumber: 'SUP-202607-try1',
          payrollMonth: new Date('2026-07-01T00:00:00.000Z'), totalAmount: new Prisma.Decimal(1700),
          items: [{ id: 'item-1', employeeId: 'employee-1', netSalary: new Prisma.Decimal(1700), advancesDeduct: new Prisma.Decimal(0), employee: { name: 'Mohammed' } }],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      invoice: { findFirst: jest.fn().mockResolvedValue(existingInvoice) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: TenantPrismaService = Object.assign(Object.create(TenantPrismaService.prototype), {
      withTenant: jest.fn((fn) => fn(tx)),
    });
    return { prisma, tx };
  }

  it('creates a paid supplementary payroll run and its salary invoice for a fully paid month', async () => {
    const { prisma, tx } = makePrisma();
    const accounting = Object.assign(Object.create(AccountingCoreService.prototype), {
      postPayrollPaymentBatchInTransaction: jest.fn().mockResolvedValue([{ invoice: { id: 'invoice-1', invoiceNumber: 'SAL-SUP-1' } }]),
    });
    const fiscal = Object.create(FiscalPeriodService.prototype) as FiscalPeriodService;
    const service = new HrPayrollIndividualPaymentService(prisma, accounting, fiscal);

    await expect(service.issue(payload, 'user-1')).resolves.toEqual(expect.objectContaining({ payrollMonth: '2026-07-01' }));
    expect(accounting.postPayrollPaymentBatchInTransaction).toHaveBeenCalledWith(
      expect.any(Object),
      [expect.objectContaining({
        kind: 'salary', employeeId: 'employee-1', totalAmount: '1700.0000', invoiceNumber: expect.stringMatching(/^SAL-SUP-/),
        debitAccountId: 'payroll-payable',
      })],
      'user-1',
      'tenant-1',
    );
    expect(tx.payrollRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ kind: 'supplementary', status: 'completed' }),
    }));
    expect(postPayrollAccrualInTransaction).toHaveBeenCalledTimes(1);
    expect(tx.payrollRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'supplementary-run-1' },
      data: expect.objectContaining({ payrollAccruedAt: expect.any(Date) }),
    }));
  });

  it('returns the already-created supplementary payroll for the same retry token', async () => {
    const existingRun = { id: 'supplementary-run-1', runNumber: 'SUP-202607-try1', items: [] };
    const { prisma, tx } = makePrisma(existingRun, { id: 'invoice-1', invoiceNumber: 'SAL-SUP-1' });
    const accounting = Object.assign(Object.create(AccountingCoreService.prototype), {
      postPayrollPaymentBatchInTransaction: jest.fn(),
    });
    const fiscal = Object.create(FiscalPeriodService.prototype) as FiscalPeriodService;
    const service = new HrPayrollIndividualPaymentService(prisma, accounting, fiscal);

    // The invoice lookup runs in the transaction; make the captured client return the existing invoice.
    await service.issue(payload);
    expect(accounting.postPayrollPaymentBatchInTransaction).not.toHaveBeenCalled();
    expect(postPayrollAccrualInTransaction).not.toHaveBeenCalled();
    expect(tx.payrollRun.create).not.toHaveBeenCalled();
  });
});
