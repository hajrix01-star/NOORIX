import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import { TenantContext } from '../common/tenant-context';
import { toYmd } from '../common/utils/to-ymd.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { assertVaultsUsableForPayment } from '../vaults/assert-vaults-for-payment.util';
import type { IssueIndividualSalaryPaymentDto } from './dto/issue-individual-salary-payment.dto';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { postPayrollAccrualInTransaction } from './hr-payroll-accrual.util';

export const INDIVIDUAL_SALARY_BATCH_PREFIX = 'salary-individual:';

export function payrollMonthStart(value: string): Date {
  const date = new Date(`${toYmd(value)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('شهر الراتب غير صالح.');
  date.setUTCDate(1);
  return date;
}

export function individualSalaryBatchId(employeeId: string, payrollMonth: Date): string {
  return `${INDIVIDUAL_SALARY_BATCH_PREFIX}${employeeId}:${toYmd(payrollMonth)}`;
}

@Injectable()
export class HrPayrollIndividualPaymentService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly accountingCore: AccountingCoreService,
    private readonly fiscalPeriod: FiscalPeriodService,
  ) {}

  async issue(dto: IssueIndividualSalaryPaymentDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const payrollMonth = payrollMonthStart(dto.payrollMonth);
    const token = String(dto.idempotencyKey || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    const monthCode = toYmd(payrollMonth).replace(/-/g, '').slice(0, 6);

    return this.prisma.withTenant(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: dto.employeeId, companyId: dto.companyId, status: { not: 'terminated' } },
        select: { id: true, name: true },
      });
      if (!employee) throw new NotFoundException('الموظف غير موجود أو غير نشط.');
      await assertVaultsUsableForPayment(tx, dto.companyId, [dto.vaultId]);

      const count = await tx.payrollRun.count({
        where: { companyId: dto.companyId, runNumber: { startsWith: `SUP-${monthCode}-` } },
      });
      const runNumber = token ? `SUP-${monthCode}-${token}` : `SUP-${monthCode}-${String(count + 1).padStart(3, '0')}`;
      const existing = await tx.payrollRun.findFirst({
        where: { companyId: dto.companyId, runNumber },
        include: { items: { include: { employee: true } } },
      });
      if (existing) {
        const invoice = await tx.invoice.findFirst({
          where: { companyId: dto.companyId, batchId: existing.id, kind: 'salary', status: 'active' },
        });
        if (invoice) return { payrollRun: existing, invoice, payrollMonth: toYmd(payrollMonth), idempotentReplay: true };
        throw new BadRequestException('تعذر إكمال المسير الإضافي السابق؛ راجع السجل قبل إعادة المحاولة.');
      }

      const payrollPayable = await tx.account.findFirst({
        where: { companyId: dto.companyId, code: 'PAY-001', type: 'liability', isActive: true },
        select: { id: true },
      });
      if (!payrollPayable) {
        throw new BadRequestException('Payroll payable account is not configured for this company.');
      }

      const amount = new Prisma.Decimal(dto.amount);
      const note = dto.notes?.trim() || `مسير إضافي — ${employee.name} — ${toYmd(payrollMonth)}`;
      const payrollRun = await tx.payrollRun.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          runNumber,
          payrollMonth,
          totalAmount: amount,
          employeeCount: 1,
          kind: 'supplementary',
          status: 'completed',
          notes: note,
          items: { create: { employeeId: dto.employeeId, grossSalary: amount, netSalary: amount, notes: note } },
          runVaultSplits: { create: { vaultId: dto.vaultId, amount } },
        },
        include: { items: { include: { employee: true } } },
      });
      await postPayrollAccrualInTransaction(
        tx,
        this.fiscalPeriod,
        this.accountingCore,
        payrollRun,
        tenantId,
        userId,
      );
      const accruedAt = new Date();
      await tx.payrollRun.update({
        where: { id: payrollRun.id },
        data: { payrollAccruedAt: accruedAt, advanceSettlementsAppliedAt: accruedAt },
      });
      const [result] = await this.accountingCore.postPayrollPaymentBatchInTransaction(tx, [{
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        invoiceNumber: `SAL-${runNumber}`,
        kind: 'salary',
        debitAccountId: payrollPayable.id,
        totalAmount: amount.toFixed(4),
        netAmount: amount.toFixed(4),
        taxAmount: '0',
        transactionDate: toYmd(dto.transactionDate),
        invoiceDate: toYmd(payrollMonth),
        batchId: payrollRun.id,
        vaultId: dto.vaultId,
        notes: note,
      }], userId, tenantId);
      await tx.auditLog.create({
        data: {
          tenantId, companyId: dto.companyId, userId, action: 'create', entity: 'supplementary_payroll_run', entityId: payrollRun.id,
          newValue: { employeeId: dto.employeeId, payrollMonth: toYmd(payrollMonth), amount: amount.toFixed(4), invoiceNumber: result.invoice.invoiceNumber },
        },
      });
      return { payrollRun, invoice: result.invoice, payrollMonth: toYmd(payrollMonth) };
    });
  }
}
