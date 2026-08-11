/**
 * HrPayrollRunLifecycleService — إنشاء/تعديل/حذف مسيرات + تغيير حالة
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import { TenantContext } from '../common/tenant-context';
import { assertVaultsUsableForPayment } from '../vaults/assert-vaults-for-payment.util';
import type { CreatePayrollRunDto, PayrollRunItemDto } from './dto/create-payroll-run.dto';
import type { UpdatePayrollRunDto, UpdatePayrollRunStatusDto } from './dto/update-payroll-run.dto';
import {
  assertPayrollItemsNetConsistent,
  assertPayrollRunVaultSplitsMatchTotal,
} from './hr-payroll-assertions.util';
import { reversePayrollAdvanceSettlementsForDelete } from './hr-payroll-advance-settlement.util';
import { HrPayrollRunReaderService } from './hr-payroll-run-reader.service';
import { HrCompensationSnapshotService } from './hr-compensation-snapshot.service';
import { assertPayrollItemsGrossMatchesCentralSnapshots } from './hr-payroll-gross-source.util';
import { buildPayrollRunItemsData, buildPayrollRunVaultSplitIds } from './hr-payroll-run-lifecycle-model';
import { assertPayrollAdvanceSelections } from './hr-payroll-advance-selection.util';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { postPayrollAccrualInTransaction } from './hr-payroll-accrual.util';

@Injectable()
export class HrPayrollRunLifecycleService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
    private readonly accountingCore: AccountingCoreService,
    private readonly reader: HrPayrollRunReaderService,
    private readonly compensationSnapshot: HrCompensationSnapshotService,
    private readonly fiscalPeriod: FiscalPeriodService,
  ) {}

  private async assertPayrollGrossUsesCentralSnapshots(
    companyId: string,
    payrollMonth: Date,
    items: PayrollRunItemDto[],
  ) {
    const employeeIds = [...new Set(items.map((item) => item.employeeId).filter(Boolean))];
    const [employees, snapshots] = await Promise.all([
      this.prisma.employee.findMany({
        where: { companyId, id: { in: employeeIds } },
        select: { id: true, joinDate: true, status: true, notes: true },
      }),
      this.compensationSnapshot.getCompanySnapshots(companyId, employeeIds),
    ]);

    const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
    const snapshotByEmployeeId = new Map(
      (snapshots.items ?? []).map((snapshot) => [snapshot.employeeId, snapshot]),
    );

    assertPayrollItemsGrossMatchesCentralSnapshots({
      items,
      employeesById,
      snapshotByEmployeeId,
      payrollMonth,
    });
  }

  async createPayrollRun(dto: CreatePayrollRunDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    assertPayrollItemsNetConsistent(dto.items);
    const payrollMonth = new Date(dto.payrollMonth);
    payrollMonth.setDate(1);
    payrollMonth.setHours(0, 0, 0, 0);
    await this.assertPayrollGrossUsesCentralSnapshots(dto.companyId, payrollMonth, dto.items);
    await assertPayrollAdvanceSelections(this.prisma, dto.companyId, payrollMonth, dto.items);

    const existing = await this.prisma.payrollRun.findFirst({
      where: { companyId: dto.companyId, payrollMonth, kind: 'regular', status: { not: 'cancelled' } },
    });
    if (existing) {
      throw new BadRequestException(
        `يوجد مسير رواتب لهذا الشهر بالفعل (${existing.runNumber}). يمكنك تعديله أو حذفه.`,
      );
    }

    const runNumber = await this.reader.generateRunNumber(dto.companyId);

    const { itemsData, totalAmount } = buildPayrollRunItemsData(dto.items);

    const splitVaultIds = buildPayrollRunVaultSplitIds(dto.vaultSplits);
    await assertVaultsUsableForPayment(this.prisma, dto.companyId, splitVaultIds);
    if (dto.vaultSplits?.length) {
      assertPayrollRunVaultSplitsMatchTotal(dto.vaultSplits, totalAmount);
    }

    const run = await this.prisma.payrollRun.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        runNumber,
        payrollMonth,
        totalAmount: new Prisma.Decimal(totalAmount),
        employeeCount: dto.items.length,
        kind: 'regular',
        status: 'draft',
        notes: dto.notes,
        items: {
          create: itemsData.map((it) => ({
            employeeId: it.employeeId,
            grossSalary: it.grossSalary,
            allowancesAdd: it.allowancesAdd,
            deductions: it.deductions,
            advancesDeduct: it.advancesDeduct,
            advanceSelections: it.advanceSelections,
            netSalary: it.netSalary,
            notes: it.notes,
          })),
        },
        runVaultSplits: dto.vaultSplits?.length
          ? {
              create: dto.vaultSplits.map((vs) => ({
                vaultId: vs.vaultId,
                amount: new Prisma.Decimal(vs.amount),
              })),
            }
          : undefined,
      },
      include: { items: { include: { employee: true } } },
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'payroll_run',
      entityId: run.id,
      newValue: { runNumber, totalAmount, employeeCount: run.employeeCount },
    });

    return run;
  }

  async updatePayrollRunStatus(
    id: string,
    dto: UpdatePayrollRunStatusDto,
    companyId: string,
    userId?: string,
  ) {
    const existing = await this.prisma.payrollRun.findFirst({
      where: { id, companyId },
      include: { items: { include: { employee: true } } },
    });
    if (!existing) throw new NotFoundException(`مسيرة الرواتب ${id} غير موجودة.`);
    if (dto.status === existing.status) return existing;
    if (existing.status === 'completed') {
      throw new BadRequestException('لا يمكن إعادة مسيرة معتمدة إلى مسودة. استخدم الإلغاء المحاسبي عند الحاجة.');
    }
    if (dto.status !== 'completed') {
      throw new BadRequestException('الانتقال المسموح هو اعتماد المسيرة المكتملة فقط.');
    }

    const tenantId = TenantContext.getTenantId();
    return this.prisma.withTenant(async (tx) => {
      const accruedAt = new Date();
      const claimed = await tx.payrollRun.updateMany({
        where: { id, companyId, status: 'draft', payrollAccruedAt: null },
        data: {
          status: 'completed',
          payrollAccruedAt: accruedAt,
          advanceSettlementsAppliedAt: accruedAt,
        },
      });
      if (claimed.count !== 1) {
        const replay = await tx.payrollRun.findFirst({
          where: { id, companyId },
          include: { items: { include: { employee: true } } },
        });
        if (replay?.status === 'completed' && replay.payrollAccruedAt) return replay;
        throw new BadRequestException('تعذر اعتماد المسيرة بسبب تعديل متزامن. حدّث الصفحة وحاول مجددًا.');
      }

      const accrual = await postPayrollAccrualInTransaction(
        tx,
        this.fiscalPeriod,
        this.accountingCore,
        existing,
        tenantId,
        userId,
      );
      await tx.auditLog.create({
        data: {
          tenantId,
          companyId,
          userId,
          action: 'post',
          entity: 'payroll_accrual',
          entityId: id,
          oldValue: { status: existing.status },
          newValue: {
            status: 'completed',
            runNumber: existing.runNumber,
            expense: accrual.expense.toFixed(4),
            payable: accrual.payable.toFixed(4),
            advances: accrual.advances.toFixed(4),
          },
        },
      });

      return tx.payrollRun.findFirstOrThrow({
        where: { id, companyId },
        include: { items: { include: { employee: true } } },
      });
    });
  }

  async updatePayrollRun(
    id: string,
    dto: UpdatePayrollRunDto,
    companyId: string,
    userId?: string,
  ) {
    const existing = await this.prisma.payrollRun.findFirst({
      where: { id, companyId },
      include: { items: { include: { vaultSplits: true } } },
    });
    if (!existing) throw new NotFoundException(`مسيرة الرواتب ${id} غير موجودة.`);
    if (existing.status === 'completed') {
      throw new BadRequestException('لا يمكن تعديل مسيرة مكتملة.');
    }

    const data: Prisma.PayrollRunUpdateInput = {
      ...(dto.notes !== undefined && { notes: dto.notes }),
    };

    if (dto.payrollMonth) {
      const payrollMonth = new Date(dto.payrollMonth);
      payrollMonth.setDate(1);
      payrollMonth.setHours(0, 0, 0, 0);
      data.payrollMonth = payrollMonth;
    }

    if (dto.items) {
      assertPayrollItemsNetConsistent(dto.items as PayrollRunItemDto[]);
      await this.assertPayrollGrossUsesCentralSnapshots(
        companyId,
        (data.payrollMonth as Date | undefined) ?? existing.payrollMonth,
        dto.items as PayrollRunItemDto[],
      );
      await assertPayrollAdvanceSelections(
        this.prisma,
        companyId,
        (data.payrollMonth as Date | undefined) ?? existing.payrollMonth,
        dto.items as PayrollRunItemDto[],
      );

      const { itemsData, totalAmount } = buildPayrollRunItemsData(dto.items as PayrollRunItemDto[]);
      data.employeeCount = dto.items.length;
      data.items = {
        deleteMany: {},
        create: itemsData,
      };
      data.totalAmount = new Prisma.Decimal(totalAmount);

      const splitVaultIds = buildPayrollRunVaultSplitIds(dto.vaultSplits);
      await assertVaultsUsableForPayment(this.prisma, companyId, splitVaultIds);
      if (dto.vaultSplits?.length) {
        assertPayrollRunVaultSplitsMatchTotal(dto.vaultSplits, totalAmount);
      }
      data.runVaultSplits =
        dto.vaultSplits !== undefined
          ? dto.vaultSplits.length
            ? {
                deleteMany: {},
                create: dto.vaultSplits.map((vs) => ({
                  vaultId: vs.vaultId,
                  amount: new Prisma.Decimal(vs.amount),
                })),
              }
            : { deleteMany: {} }
          : { deleteMany: {} };
    } else if (dto.vaultSplits !== undefined) {
      const totalAmount = Number(existing.totalAmount);
      const splitVaultIds = buildPayrollRunVaultSplitIds(dto.vaultSplits);
      await assertVaultsUsableForPayment(this.prisma, companyId, splitVaultIds);
      if (dto.vaultSplits.length) {
        assertPayrollRunVaultSplitsMatchTotal(dto.vaultSplits, totalAmount);
      }
      data.runVaultSplits = dto.vaultSplits.length
        ? {
            deleteMany: {},
            create: dto.vaultSplits.map((vs) => ({
              vaultId: vs.vaultId,
              amount: new Prisma.Decimal(vs.amount),
            })),
          }
        : { deleteMany: {} };
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id },
      data,
      include: { items: { include: { employee: true } } },
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'payroll_run',
      entityId: id,
      oldValue: {
        notes: existing.notes,
        payrollMonth: existing.payrollMonth,
        employeeCount: existing.employeeCount,
        totalAmount: existing.totalAmount,
      },
      newValue: {
        notes: updated.notes,
        payrollMonth: updated.payrollMonth,
        employeeCount: updated.employeeCount,
        totalAmount: updated.totalAmount,
      },
    });

    return updated;
  }

  async deletePayrollRun(id: string, companyId: string, userId?: string) {
    const existing = await this.prisma.payrollRun.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException(`مسيرة الرواتب ${id} غير موجودة.`);

    if (existing.status === 'draft') {
      await this.prisma.payrollRun.delete({ where: { id } });
      await this.audit.log({
        companyId,
        userId,
        action: 'delete',
        entity: 'payroll_run',
        entityId: id,
        oldValue: { runNumber: existing.runNumber, status: 'draft' },
      });
      return { deleted: true, id };
    }

    if (existing.status !== 'completed') {
      throw new BadRequestException('لا يمكن حذف مسيرة بهذه الحالة.');
    }

    const salaryInvoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        batchId: id,
        kind: 'salary',
      },
    });

    let cancelledSalaryCount = 0;
    for (const inv of salaryInvoices) {
      if (inv.status === 'cancelled') continue;
      await this.accountingCore.reverseFinancialOperation(
        {
          companyId,
          referenceType: 'salary',
          referenceId: inv.id,
          reason: `حذف مسيرة رواتب ${existing.runNumber}`,
        },
        userId,
      );
      cancelledSalaryCount += 1;
    }

    await this.prisma.withTenant(async (tx) => {
      await reversePayrollAdvanceSettlementsForDelete(tx, companyId, existing.runNumber);
      await this.accountingCore.cancelPayrollAccrualLedgerInTransaction(tx, companyId, id);
      await tx.payrollRun.delete({ where: { id } });
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'delete',
      entity: 'payroll_run',
      entityId: id,
      oldValue: {
        runNumber: existing.runNumber,
        status: 'completed',
        salaryInvoicesFound: salaryInvoices.length,
        salaryInvoicesCancelled: cancelledSalaryCount,
      },
    });

    return {
      deleted: true,
      id,
      cancelledSalaryInvoices: cancelledSalaryCount,
    };
  }
}
