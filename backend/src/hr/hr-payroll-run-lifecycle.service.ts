/**
 * HrPayrollRunLifecycleService — إنشاء/تعديل/حذف مسيرات + تغيير حالة
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { TenantContext } from '../common/tenant-context';
import { assertVaultsUsableForPayment } from '../vaults/assert-vaults-for-payment.util';
import type { CreatePayrollRunDto, PayrollRunItemDto } from './dto/create-payroll-run.dto';
import type { UpdatePayrollRunDto, UpdatePayrollRunStatusDto } from './dto/update-payroll-run.dto';
import {
  assertPayrollItemsNetConsistent,
  assertPayrollRunVaultSplitsMatchTotal,
} from './hr-payroll-assertions.util';
import {
  applyPayrollAdvanceSettlements,
  reversePayrollAdvanceSettlementsForDelete,
} from './hr-payroll-advance-settlement.util';
import { HrPayrollRunReaderService } from './hr-payroll-run-reader.service';
import { saudiDateYmd } from './utils/hr-saudi-dates.util';

@Injectable()
export class HrPayrollRunLifecycleService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
    private readonly financialCore: FinancialCoreService,
    private readonly reader: HrPayrollRunReaderService,
  ) {}

  async createPayrollRun(dto: CreatePayrollRunDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    assertPayrollItemsNetConsistent(dto.items);
    const payrollMonth = new Date(dto.payrollMonth);
    payrollMonth.setDate(1);
    payrollMonth.setHours(0, 0, 0, 0);

    const existing = await this.prisma.payrollRun.findFirst({
      where: { companyId: dto.companyId, payrollMonth, status: { not: 'cancelled' } },
    });
    if (existing) {
      throw new BadRequestException(
        `يوجد مسير رواتب لهذا الشهر بالفعل (${existing.runNumber}). يمكنك تعديله أو حذفه.`,
      );
    }

    const runNumber = await this.reader.generateRunNumber(dto.companyId);

    let totalAmount = 0;
    const itemsData: Array<{
      employeeId: string;
      grossSalary: Prisma.Decimal;
      allowancesAdd: Prisma.Decimal;
      deductions: Prisma.Decimal;
      advancesDeduct: Prisma.Decimal;
      netSalary: Prisma.Decimal;
      notes?: string;
    }> = [];

    for (const item of dto.items) {
      const net = Number(item.netSalary);
      totalAmount += net;
      itemsData.push({
        employeeId: item.employeeId,
        grossSalary: new Prisma.Decimal(item.grossSalary),
        allowancesAdd: new Prisma.Decimal(item.allowancesAdd ?? 0),
        deductions: new Prisma.Decimal(item.deductions ?? 0),
        advancesDeduct: new Prisma.Decimal(item.advancesDeduct ?? 0),
        netSalary: new Prisma.Decimal(item.netSalary),
        notes: item.notes,
      });
    }

    const splitVaultIds = (dto.vaultSplits ?? []).map((vs) => vs.vaultId);
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
        status: 'draft',
        notes: dto.notes,
        items: {
          create: itemsData.map((it) => ({
            employeeId: it.employeeId,
            grossSalary: it.grossSalary,
            allowancesAdd: it.allowancesAdd,
            deductions: it.deductions,
            advancesDeduct: it.advancesDeduct,
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

    const shouldApplyAdvances =
      dto.status === 'completed' &&
      existing.status === 'draft' &&
      !existing.advanceSettlementsAppliedAt;

    let updated: Awaited<ReturnType<typeof this.prisma.payrollRun.update>>;

    if (shouldApplyAdvances) {
      const tenantId = TenantContext.getTenantId();
      const txDate = saudiDateYmd();
      updated = await this.prisma.withTenant(async (tx) => {
        await applyPayrollAdvanceSettlements(
          tx,
          {
            companyId: existing.companyId,
            runNumber: existing.runNumber,
            payrollMonth: existing.payrollMonth,
            items: existing.items,
          },
          txDate,
          tenantId,
        );
        return tx.payrollRun.update({
          where: { id },
          data: {
            status: 'completed',
            advanceSettlementsAppliedAt: new Date(),
          },
        });
      });
    } else {
      updated = await this.prisma.payrollRun.update({
        where: { id },
        data: { status: dto.status },
      });
    }

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'payroll_run',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: dto.status },
    });

    return updated;
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

      let totalAmount = 0;
      data.employeeCount = dto.items.length;
      data.items = {
        deleteMany: {},
        create: dto.items.map((item) => {
          totalAmount += Number(item.netSalary ?? 0);
          return {
            employeeId: item.employeeId,
            grossSalary: new Prisma.Decimal(item.grossSalary),
            allowancesAdd: new Prisma.Decimal(item.allowancesAdd ?? 0),
            deductions: new Prisma.Decimal(item.deductions ?? 0),
            advancesDeduct: new Prisma.Decimal(item.advancesDeduct ?? 0),
            netSalary: new Prisma.Decimal(item.netSalary),
            notes: item.notes,
          };
        }),
      };
      data.totalAmount = new Prisma.Decimal(totalAmount);

      const splitVaultIds = (dto.vaultSplits ?? []).map((vs) => vs.vaultId);
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
      const splitVaultIds = dto.vaultSplits.map((vs) => vs.vaultId);
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
      await this.financialCore.cancelOperation(
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
