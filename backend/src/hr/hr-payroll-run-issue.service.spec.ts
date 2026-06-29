import { Prisma } from '@prisma/client';
import { HrPayrollRunIssueService } from './hr-payroll-run-issue.service';

jest.mock('../common/tenant-context', () => ({
  TenantContext: { getTenantId: jest.fn(() => 'tenant-1') },
}));

jest.mock('../vaults/assert-vaults-for-payment.util', () => ({
  assertVaultsUsableForPayment: jest.fn(),
}));

describe('HrPayrollRunIssueService', () => {
  const baseRun = {
    id: 'run-1',
    companyId: 'co-1',
    status: 'completed',
    totalAmount: new Prisma.Decimal(1000),
    runNumber: 'PR-1',
    employeeCount: 2,
    payrollMonth: new Date('2026-06-01T00:00:00.000Z'),
    advanceSettlementsAppliedAt: new Date('2026-06-30T00:00:00.000Z'),
    runVaultSplits: [],
    items: [],
  };

  it('issues payroll payment inside one transaction', async () => {
    const tx = {
      payrollRun: {
        findFirst: jest.fn().mockResolvedValue({ advanceSettlementsAppliedAt: new Date('2026-06-30T00:00:00.000Z') }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      payrollRun: { findFirst: jest.fn().mockResolvedValue(baseRun) },
      invoice: { findFirst: jest.fn().mockResolvedValue(null) },
      vault: { findFirst: jest.fn().mockResolvedValue({ id: 'vault-1' }) },
      $transaction: jest.fn((fn) => fn(tx)),
    } as any;
    const financialCore = {
      processOutflowBatchInTransaction: jest.fn().mockResolvedValue([{ invoice: { id: 'inv-1' } }]),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new HrPayrollRunIssueService(prisma, audit as any, financialCore as any);

    const result = await service.issuePayrollPayment({
      payrollRunId: 'run-1',
      transactionDate: '2026-06-30',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(financialCore.processOutflowBatchInTransaction).toHaveBeenCalledWith(
      tx,
      expect.any(Array),
      undefined,
      'tenant-1',
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'create',
        entity: 'payroll_payment',
        entityId: 'run-1',
      }),
    }));
    expect(result).toEqual({
      payrollRunId: 'run-1',
      invoicesCreated: 1,
      invoices: [{ id: 'inv-1' }],
    });
  });

  it('treats an existing salary invoice as an idempotent replay', async () => {
    const prisma = {
      payrollRun: { findFirst: jest.fn().mockResolvedValue(baseRun) },
      invoice: { findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', invoiceNumber: 'SAL-PR-1' }) },
      vault: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    } as any;
    const financialCore = { processOutflowBatchInTransaction: jest.fn() };
    const audit = { log: jest.fn() };
    const service = new HrPayrollRunIssueService(prisma, audit as any, financialCore as any);

    const result = await service.issuePayrollPayment({
      payrollRunId: 'run-1',
      transactionDate: '2026-06-30',
    });

    expect(result).toEqual({
      payrollRunId: 'run-1',
      invoicesCreated: 0,
      invoices: [{ id: 'inv-1', invoiceNumber: 'SAL-PR-1' }],
      idempotentReplay: true,
    });
    expect(financialCore.processOutflowBatchInTransaction).not.toHaveBeenCalled();
  });
});
