import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import { TenantContext } from '../common/tenant-context';
import { assertVaultsUsableForPayment } from '../vaults/assert-vaults-for-payment.util';
import type { IssuePayrollPaymentDto } from './dto/issue-payroll-payment.dto';
import { assertPayrollRunVaultSplitsMatchTotal } from './hr-payroll-assertions.util';
import { applyPayrollAdvanceSettlements } from './hr-payroll-advance-settlement.util';
import { toYmd } from '../common/utils/to-ymd.util';
import { individualSalaryBatchId } from './hr-payroll-individual-payment.service';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { postPayrollAccrualInTransaction } from './hr-payroll-accrual.util';

type PayrollRunForIssue = NonNullable<
  Awaited<ReturnType<TenantPrismaService['payrollRun']['findFirst']>>
> & {
  runVaultSplits: Array<{ vaultId: string; amount: Prisma.Decimal }>;
  items: Array<{
    employeeId: string;
    advancesDeduct: Prisma.Decimal | null;
    netSalary: Prisma.Decimal;
    advanceSelections?: Prisma.JsonValue | null;
    employee: { name: string | null } | null;
  }>;
};

@Injectable()
export class HrPayrollRunIssueService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
    private readonly accountingCore: AccountingCoreService,
    private readonly fiscalPeriod: FiscalPeriodService,
  ) {}

  async issuePayrollPayment(dto: IssuePayrollPaymentDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: dto.payrollRunId },
      include: {
        runVaultSplits: true,
        items: {
          include: {
            employee: true,
            vaultSplits: true,
          },
        },
      },
    });
    if (!run) throw new NotFoundException('مسيرة الرواتب غير موجودة.');
    if (run.status !== 'completed') {
      throw new BadRequestException('يجب إكمال مسيرة الرواتب قبل إصدار الدفع.');
    }

    const txDate = toYmd(dto.transactionDate);
    const existingSalaryInvoice = await this.prisma.invoice.findFirst({
      where: {
        companyId: run.companyId,
        batchId: run.id,
        kind: 'salary',
        status: 'active',
      },
    });
    if (existingSalaryInvoice) {
      await this.completePayrollAdvanceSettlementsIfNeeded(run as PayrollRunForIssue, txDate, tenantId);
      return {
        payrollRunId: run.id,
        invoicesCreated: 0,
        invoices: [existingSalaryInvoice],
        idempotentReplay: true,
      };
    }

    const individualPayments = await this.prisma.invoice.aggregate({
      where: {
        companyId: run.companyId,
        kind: 'salary',
        status: 'active',
        employeeId: { in: run.items.map((item) => item.employeeId) },
        OR: run.items.map((item) => ({ batchId: individualSalaryBatchId(item.employeeId, run.payrollMonth) })),
      },
      _sum: { totalAmount: true },
    });
    const individualPaid = new Prisma.Decimal(individualPayments._sum.totalAmount ?? 0);
    const totalDec = new Prisma.Decimal(run.totalAmount).minus(individualPaid);
    if (totalDec.lt(0)) {
      throw new BadRequestException('دفعات الرواتب الفردية تتجاوز صافي المسير. صحح الدفعات قبل إصدار المسير.');
    }
    if (totalDec.isZero()) {
      await this.completePayrollAdvanceSettlementsIfNeeded(run as PayrollRunForIssue, txDate, tenantId);
      return { payrollRunId: run.id, invoicesCreated: 0, invoices: [], fullyPaidIndividually: true };
    }
    const totalStr = totalDec.toFixed(4);

    const defaultVault = await this.prisma.vault.findFirst({
      where: {
        companyId: run.companyId,
        isActive: true,
        isArchived: false,
        showAsPaymentMethod: true,
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    const payrollPayable = await this.prisma.account.findFirst({
      where: { companyId: run.companyId, code: 'PAY-001', type: 'liability', isActive: true },
      select: { id: true },
    });
    if (!payrollPayable) {
      throw new BadRequestException('Payroll payable account is not configured for this company.');
    }

    if (!defaultVault) {
      throw new BadRequestException(
        'لا توجد خزنة نشطة. يرجى تحديد توزيع الخزائن للمسيرة أو إنشاء خزنة.',
      );
    }

    let vaultSplitsOut: Array<{ vaultId: string; amount: string }>;

    if (dto.vaultSplits?.length) {
      const splitVaultIds = dto.vaultSplits.map((vs) => vs.vaultId);
      await assertVaultsUsableForPayment(this.prisma, run.companyId, splitVaultIds);
      assertPayrollRunVaultSplitsMatchTotal(
        dto.vaultSplits.map((vs) => ({ vaultId: vs.vaultId, amount: vs.amount })),
        Number(totalDec),
      );
      vaultSplitsOut = dto.vaultSplits.map((vs) => ({
        vaultId: vs.vaultId,
        amount: String(vs.amount),
      }));
    } else if (run.runVaultSplits?.length) {
      vaultSplitsOut = run.runVaultSplits.map((vs) => ({
        vaultId: vs.vaultId,
        amount: String(vs.amount),
      }));
      const sumDec = run.runVaultSplits.reduce(
        (a, vs) => a.plus(new Prisma.Decimal(vs.amount)),
        new Prisma.Decimal(0),
      );
      if (sumDec.minus(totalDec).abs().gt(0.02)) {
        throw new BadRequestException('مجموع توزيع خزائن المسيرة لا يطابق إجمالي المسيرة.');
      }
    } else {
      vaultSplitsOut = [{ vaultId: defaultVault.id, amount: totalStr }];
    }

    const dtos = [
      {
        companyId: run.companyId,
        employeeId: undefined as string | undefined,
        invoiceNumber: `SAL-${run.runNumber}`,
        kind: 'salary' as const,
        totalAmount: totalStr,
        netAmount: totalStr,
        taxAmount: '0',
        transactionDate: txDate,
        debitAccountId: payrollPayable.id,
        batchId: run.id,
        vaultSplits: vaultSplitsOut,
        notes: `مسيرة رواتب ${run.runNumber} (${run.employeeCount} موظف)`,
      },
    ];

    const results = await this.prisma.withTenant(async (tx) => {
      const lockedRun = await tx.payrollRun.findFirst({
        where: { id: run.id },
        select: { advanceSettlementsAppliedAt: true, payrollAccruedAt: true },
      });
      if (!lockedRun) throw new NotFoundException('مسيرة الرواتب غير موجودة.');

      const created = await this.accountingCore.postPayrollPaymentBatchInTransaction(
        tx,
        dtos,
        userId,
        tenantId,
      );

      if (!lockedRun.payrollAccruedAt) {
        await postPayrollAccrualInTransaction(
          tx,
          this.fiscalPeriod,
          this.accountingCore,
          run as PayrollRunForIssue,
          tenantId,
          userId,
        );
        const postedAt = new Date();
        await tx.payrollRun.update({
          where: { id: run.id },
          data: { payrollAccruedAt: postedAt, advanceSettlementsAppliedAt: postedAt },
        });
      } else if (!lockedRun.advanceSettlementsAppliedAt) {
        await applyPayrollAdvanceSettlements(
          tx,
          {
            companyId: run.companyId,
            runNumber: run.runNumber,
            payrollMonth: run.payrollMonth,
            items: run.items,
          },
          txDate,
          tenantId,
        );
        await tx.payrollRun.update({
          where: { id: run.id },
          data: { advanceSettlementsAppliedAt: new Date() },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          companyId: run.companyId,
          userId,
          action: 'create',
          entity: 'payroll_payment',
          entityId: run.id,
          newValue: {
            payrollRunId: run.id,
            runNumber: run.runNumber,
            invoiceCount: created.length,
          } as object,
        },
      });

      return created;
    });

    return {
      payrollRunId: run.id,
      invoicesCreated: results.length,
      invoices: results.map((r) => r.invoice),
    };
  }

  private async completePayrollAdvanceSettlementsIfNeeded(
    run: PayrollRunForIssue,
    txDate: string,
    tenantId: string,
  ): Promise<void> {
    if (run.advanceSettlementsAppliedAt) return;

    await this.prisma.withTenant(async (tx) => {
      const lockedRun = await tx.payrollRun.findFirst({
        where: { id: run.id },
        select: { advanceSettlementsAppliedAt: true },
      });
      if (lockedRun?.advanceSettlementsAppliedAt) return;

      await applyPayrollAdvanceSettlements(
        tx,
        {
          companyId: run.companyId,
          runNumber: run.runNumber,
          payrollMonth: run.payrollMonth,
          items: run.items,
        },
        txDate,
        tenantId,
      );
      await tx.payrollRun.update({
        where: { id: run.id },
        data: { advanceSettlementsAppliedAt: new Date() },
      });
    });
  }
}
