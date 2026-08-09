import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { HrPayrollIndividualPaymentService } from './hr-payroll-individual-payment.service';

jest.mock('../common/tenant-context', () => ({
  TenantContext: { getTenantId: jest.fn(() => 'tenant-1') },
}));

describe('HrPayrollIndividualPaymentService', () => {
  const employee = {
    id: 'employee-1',
    name: 'Mohammed',
    basicSalary: new Prisma.Decimal(3000),
    housingAllowance: new Prisma.Decimal(0),
    transportAllowance: new Prisma.Decimal(0),
    otherAllowance: new Prisma.Decimal(0),
  };
  const approvedRun = {
    id: 'run-1',
    status: 'completed',
    items: [{ netSalary: new Prisma.Decimal(3000) }],
  };

  function makePrisma(issuedPayrollInvoice: { id: string } | null = null): TenantPrismaService {
    return Object.assign(Object.create(TenantPrismaService.prototype), {
      employee: { findFirst: jest.fn().mockResolvedValue(employee) },
      vault: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'vault-1', nameAr: 'Main vault', isActive: true, isArchived: false, showAsPaymentMethod: true,
        }]),
      },
      payrollRun: { findFirst: jest.fn().mockResolvedValue(approvedRun) },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(issuedPayrollInvoice),
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: new Prisma.Decimal(0) } }),
      },
    });
  }

  const payload = {
    companyId: 'company-1', employeeId: 'employee-1', payrollMonth: '2026-07-01', amount: 2000,
    vaultId: 'vault-1', transactionDate: '2026-07-31', idempotencyKey: 'try-1',
  };

  it('allows an individual payment after approval when the payroll run has not been issued', async () => {
    const prisma = makePrisma();
    const accounting = Object.assign(Object.create(AccountingCoreService.prototype), {
      postHrServiceExpense: jest.fn().mockResolvedValue({ invoice: { id: 'invoice-1', invoiceNumber: 'SAL-1' } }),
    });
    const audit = Object.assign(Object.create(AuditLogService.prototype), { log: jest.fn().mockResolvedValue(undefined) });
    const service = new HrPayrollIndividualPaymentService(prisma, accounting, audit);

    await expect(service.issue(payload, 'user-1')).resolves.toEqual(expect.objectContaining({ payrollMonth: '2026-07-01' }));
    expect(accounting.postHrServiceExpense).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'salary', batchId: 'salary-individual:employee-1:2026-07-01', totalAmount: '2000',
    }), 'user-1');
  });

  it('rejects an individual payment after the full payroll invoice has been issued', async () => {
    const service = new HrPayrollIndividualPaymentService(
      makePrisma({ id: 'payroll-invoice-1' }),
      Object.assign(Object.create(AccountingCoreService.prototype), { postHrServiceExpense: jest.fn() }),
      Object.assign(Object.create(AuditLogService.prototype), { log: jest.fn() }),
    );

    await expect(service.issue(payload)).rejects.toBeInstanceOf(BadRequestException);
  });
});
