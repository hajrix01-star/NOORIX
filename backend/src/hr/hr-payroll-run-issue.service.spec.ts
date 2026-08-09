import { Prisma } from '@prisma/client';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
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
    const prisma: TenantPrismaService = Object.assign(Object.create(TenantPrismaService.prototype), {
      payrollRun: { findFirst: jest.fn().mockResolvedValue(baseRun) },
      invoice: { findFirst: jest.fn().mockResolvedValue(null), aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: new Prisma.Decimal(0) } }) },
      vault: { findFirst: jest.fn().mockResolvedValue({ id: 'vault-1' }) },
      $transaction: jest.fn((fn) => fn(tx)),
    });
    const accountingCore: AccountingCoreService = Object.assign(Object.create(AccountingCoreService.prototype), {
      postPayrollPaymentBatchInTransaction: jest.fn().mockResolvedValue([{ invoice: { id: 'inv-1' } }]),
    });
    const audit: AuditLogService = Object.assign(Object.create(AuditLogService.prototype), {
      log: jest.fn().mockResolvedValue(undefined),
    });
    const service = new HrPayrollRunIssueService(prisma, audit, accountingCore);

    const result = await service.issuePayrollPayment({
      payrollRunId: 'run-1',
      transactionDate: '2026-06-30',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(accountingCore.postPayrollPaymentBatchInTransaction).toHaveBeenCalledWith(
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

  it('forwards an arbitrary number of exact vault allocations to the accounting core', async () => {
    const tx = {
      payrollRun: {
        findFirst: jest.fn().mockResolvedValue({ advanceSettlementsAppliedAt: new Date('2026-06-30T00:00:00.000Z') }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: TenantPrismaService = Object.assign(Object.create(TenantPrismaService.prototype), {
      payrollRun: { findFirst: jest.fn().mockResolvedValue(baseRun) },
      invoice: { findFirst: jest.fn().mockResolvedValue(null), aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: new Prisma.Decimal(0) } }) },
      vault: { findFirst: jest.fn().mockResolvedValue({ id: 'vault-default' }) },
      $transaction: jest.fn((fn) => fn(tx)),
    });
    const accountingCore: AccountingCoreService = Object.assign(Object.create(AccountingCoreService.prototype), {
      postPayrollPaymentBatchInTransaction: jest.fn().mockResolvedValue([{ invoice: { id: 'inv-1' } }]),
    });
    const audit: AuditLogService = Object.assign(Object.create(AuditLogService.prototype), {
      log: jest.fn().mockResolvedValue(undefined),
    });
    const service = new HrPayrollRunIssueService(prisma, audit, accountingCore);

    await service.issuePayrollPayment({
      payrollRunId: 'run-1',
      transactionDate: '2026-06-30',
      vaultSplits: [
        { vaultId: 'vault-1', amount: 400 },
        { vaultId: 'vault-2', amount: 350 },
        { vaultId: 'vault-3', amount: 250 },
      ],
    });

    expect(accountingCore.postPayrollPaymentBatchInTransaction).toHaveBeenCalledWith(
      tx,
      [expect.objectContaining({
        totalAmount: '1000.0000',
        vaultSplits: [
          { vaultId: 'vault-1', amount: '400' },
          { vaultId: 'vault-2', amount: '350' },
          { vaultId: 'vault-3', amount: '250' },
        ],
      })],
      undefined,
      'tenant-1',
    );
  });

  it('issues only the remaining amount after an individual salary payment', async () => {
    const runWithEmployee = {
      ...baseRun,
      items: [{ employeeId: 'employee-1', advancesDeduct: null, employee: { name: 'Employee' } }],
    };
    const tx = {
      payrollRun: {
        findFirst: jest.fn().mockResolvedValue({ advanceSettlementsAppliedAt: new Date('2026-06-30T00:00:00.000Z') }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: TenantPrismaService = Object.assign(Object.create(TenantPrismaService.prototype), {
      payrollRun: { findFirst: jest.fn().mockResolvedValue(runWithEmployee) },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: new Prisma.Decimal(250) } }),
      },
      vault: { findFirst: jest.fn().mockResolvedValue({ id: 'vault-default' }) },
      $transaction: jest.fn((fn) => fn(tx)),
    });
    const accountingCore: AccountingCoreService = Object.assign(Object.create(AccountingCoreService.prototype), {
      postPayrollPaymentBatchInTransaction: jest.fn().mockResolvedValue([{ invoice: { id: 'inv-remaining' } }]),
    });
    const service = new HrPayrollRunIssueService(
      prisma,
      Object.assign(Object.create(AuditLogService.prototype), { log: jest.fn() }),
      accountingCore,
    );

    await service.issuePayrollPayment({
      payrollRunId: 'run-1',
      transactionDate: '2026-06-30',
      vaultSplits: [{ vaultId: 'vault-default', amount: 750 }],
    });

    expect(accountingCore.postPayrollPaymentBatchInTransaction).toHaveBeenCalledWith(
      tx,
      [expect.objectContaining({
        totalAmount: '750.0000',
        vaultSplits: [{ vaultId: 'vault-default', amount: '750' }],
      })],
      undefined,
      'tenant-1',
    );
  });

  it('treats an existing salary invoice as an idempotent replay', async () => {
    const prisma: TenantPrismaService = Object.assign(Object.create(TenantPrismaService.prototype), {
      payrollRun: { findFirst: jest.fn().mockResolvedValue(baseRun) },
      invoice: { findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', invoiceNumber: 'SAL-PR-1' }) },
      vault: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    });
    const accountingCore: AccountingCoreService = Object.assign(Object.create(AccountingCoreService.prototype), {
      postPayrollPaymentBatchInTransaction: jest.fn(),
    });
    const audit: AuditLogService = Object.assign(Object.create(AuditLogService.prototype), { log: jest.fn() });
    const service = new HrPayrollRunIssueService(prisma, audit, accountingCore);

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
    expect(accountingCore.postPayrollPaymentBatchInTransaction).not.toHaveBeenCalled();
  });
});
