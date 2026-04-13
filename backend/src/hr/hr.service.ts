/**
 * HRService — إدارة الرواتب، الإجازات، الإقامات، المستندات، الحركات، البدلات، الخصومات
 *
 * يستخدم TenantPrismaService، AuditLogService، FinancialCoreService.
 * عمليات الدفع المالي (issue-payment) تُفوَّض للمحرك المالي المركزي.
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { TenantContext } from '../common/tenant-context';
import { nowSaudi } from '../common/utils/date-utils';
import type {
  CreatePayrollRunDto,
  PayrollRunItemDto,
} from './dto/create-payroll-run.dto';
import type { UpdatePayrollRunDto, UpdatePayrollRunStatusDto } from './dto/update-payroll-run.dto';
import type { CreateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';
import type { CreateResidencyDto } from './dto/create-residency.dto';
import type { UpdateResidencyDto } from './dto/update-residency.dto';
import type { CreateDocumentDto } from './dto/create-document.dto';
import type { CreateMovementDto } from './dto/create-movement.dto';
import type { CreateAllowanceDto } from './dto/create-allowance.dto';
import type { CreateDeductionDto } from './dto/create-deduction.dto';
import type { IssuePayrollPaymentDto } from './dto/issue-payroll-payment.dto';
import type { ReturnFromLeaveDto } from './dto/return-from-leave.dto';
import type { IssueLeaveSalarySettlementDto } from './dto/issue-leave-salary-settlement.dto';
import { toMoneyDecimal2 } from '../common/utils/money-decimal';
import {
  computeCalendarLeaveSalarySettlement,
} from './utils/leave-salary-settlement.util';

@Injectable()
export class HRService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
    private readonly financialCore: FinancialCoreService,
  ) {}

  // ══════════════════════════════════════════════════════════
  // PAYROLL RUNS
  // ══════════════════════════════════════════════════════════

  private async assertVaultsUsableForPayment(companyId: string, vaultIds: string[]): Promise<void> {
    const ids = [...new Set(vaultIds.filter(Boolean))];
    if (!ids.length) return;
    const vaults = await this.prisma.vault.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true, nameAr: true, isActive: true, showAsPaymentMethod: true, isArchived: true },
    });
    const byId = new Map(vaults.map((v) => [v.id, v]));
    for (const id of ids) {
      const v = byId.get(id);
      if (!v) throw new BadRequestException('خزنة غير موجودة أو لا تنتمي للشركة.');
      if (v.isActive === false) throw new BadRequestException(`الخزينة «${v.nameAr}» غير نشطة.`);
      if (v.isArchived) throw new BadRequestException(`الخزينة «${v.nameAr}» مؤرشفة.`);
      if (v.showAsPaymentMethod === false) {
        throw new BadRequestException(
          `الخزينة «${v.nameAr}» غير متاحة للسداد. فعّل «الظهور كطريقة سداد» من شاشة الخزائن.`,
        );
      }
    }
  }

  private async generateRunNumber(companyId: string): Promise<string> {
    const now = nowSaudi();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `PR-${yy}${mm}`;
    const count = await this.prisma.payrollRun.count({
      where: { companyId, runNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  async findPayrollRuns(companyId: string, year?: number) {
    const where: Prisma.PayrollRunWhereInput = { companyId };
    if (year) {
      where.payrollMonth = {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      };
    }
    return this.prisma.payrollRun.findMany({
      where,
      include: { items: { include: { employee: true } } },
      orderBy: { payrollMonth: 'desc' },
    });
  }

  async findPayrollRunItemsByEmployee(companyId: string, employeeId: string) {
    return this.prisma.payrollRunItem.findMany({
      where: { employeeId, payrollRun: { companyId } },
      include: {
        payrollRun: {
          select: {
            id: true,
            runNumber: true,
            payrollMonth: true,
            status: true,
          },
        },
      },
      orderBy: { payrollRun: { payrollMonth: 'desc' } },
    });
  }

  async findPayrollRunById(id: string, companyId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, companyId },
      include: {
        runVaultSplits: { include: { vault: true } },
        items: {
          include: {
            employee: true,
            vaultSplits: { include: { vault: true } },
          },
        },
      },
    });
    if (!run) throw new NotFoundException(`مسيرة الرواتب ${id} غير موجودة.`);
    return run;
  }

  private saudiDateYmd(): string {
    const d = nowSaudi();
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }

  /** YYYY-MM-DD بتوقيت السعودية لتاريخ مخزّن. */
  private dateToSaudiYmd(d: Date): string {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  }

  private isSaudiYmdInLeaveRange(ymd: string, start: Date, end: Date): boolean {
    const s = this.dateToSaudiYmd(start);
    const e = this.dateToSaudiYmd(end);
    return ymd >= s && ymd <= e;
  }

  private daysInclusiveBetweenSaudiYmd(startYmd: string, endYmd: string): number {
    const d0 = new Date(`${startYmd}T00:00:00.000Z`);
    const d1 = new Date(`${endYmd}T00:00:00.000Z`);
    if (d1 < d0) return 0;
    const n = Math.round((d1.getTime() - d0.getTime()) / 86400000) + 1;
    return Math.max(1, n);
  }

  /** إن كان اليوم (سعودي) ضمن فترة إجازة معتمدة → on_leave. وإلا وكان on_leave → active. */
  private async syncEmployeeLeavePresence(employeeId: string, companyId: string): Promise<void> {
    const today = this.saudiDateYmd();
    const leaves = await this.prisma.leave.findMany({
      where: { employeeId, companyId, status: 'approved' },
      select: { startDate: true, endDate: true },
    });
    const anyInRange = leaves.some((l) => this.isSaudiYmdInLeaveRange(today, l.startDate, l.endDate));
    if (anyInRange) {
      await this.prisma.employee.updateMany({
        where: { id: employeeId, companyId, status: { in: ['active', 'on_leave'] } },
        data: { status: 'on_leave' },
      });
    } else {
      await this.prisma.employee.updateMany({
        where: { id: employeeId, companyId, status: 'on_leave' },
        data: { status: 'active' },
      });
    }
  }

  private async maybeSetEmployeeOnLeaveAfterApproval(
    employeeId: string,
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const today = this.saudiDateYmd();
    if (!this.isSaudiYmdInLeaveRange(today, startDate, endDate)) return;
    await this.prisma.employee.updateMany({
      where: { id: employeeId, companyId, status: { in: ['active', 'on_leave'] } },
      data: { status: 'on_leave' },
    });
  }

  private parseAdvanceDeferMonth(notes?: string | null): string {
    const m = String(notes || '').match(/\[ADV_DEFER\]\s*(\d{4}-\d{2})/);
    return m ? m[1] : '';
  }

  /**
   * تخصيم السلف من فواتير السلف وربطها بالمسيرة (نفس منطق صرف المسيرة).
   * يُستدعى عند اعتماد المسيرة أو عند الصرف إن لم تُطبَّق من قبل.
   */
  private async applyPayrollAdvanceSettlements(
    db: Pick<TenantPrismaService, 'invoice' | 'employeeDeduction'>,
    run: {
      companyId: string;
      runNumber: string;
      payrollMonth: Date;
      items: Array<{
        employeeId: string;
        advancesDeduct: Prisma.Decimal | null;
        employee: { name: string | null } | null;
      }>;
    },
    txDate: string,
    tenantId: string,
  ): Promise<void> {
    const runMonth = `${run.payrollMonth.getFullYear()}-${String(run.payrollMonth.getMonth() + 1).padStart(2, '0')}`;

    for (const item of run.items) {
      let remainingToDeduct = Number(item.advancesDeduct ?? 0);
      if (remainingToDeduct <= 0) continue;

      const advances = await db.invoice.findMany({
        where: {
          companyId: run.companyId,
          employeeId: item.employeeId,
          kind: 'advance',
          status: 'active',
        },
        orderBy: { transactionDate: 'asc' },
      });

      for (const adv of advances) {
        if (remainingToDeduct <= 0) break;
        const deferMonth = this.parseAdvanceDeferMonth(adv.notes);
        if (deferMonth && deferMonth > runMonth) continue;

        const total = Number(adv.totalAmount ?? 0);
        const settled = Number(adv.settledAmount ?? 0);
        const remaining = Math.max(0, total - settled);
        if (remaining <= 0) continue;

        // إن كانت السلفة بأقساط محددة، اقتطع القسط فقط — لا الرصيد الكامل
        const cap = adv.installmentAmount
          ? Math.min(Number(adv.installmentAmount), remaining)
          : remaining;
        const allocate = Math.min(remainingToDeduct, cap);
        const newSettled = settled + allocate;
        const fullySettled = newSettled >= total;
        const settleNote = `${adv.notes || ''}\n[ADV_PAYROLL] run=${run.runNumber}, amount=${allocate}, date=${txDate}`.trim();

        await db.invoice.update({
          where: { id: adv.id },
          data: {
            settledAmount: new Prisma.Decimal(newSettled),
            settledAt: fullySettled ? new Date(`${txDate}T00:00:00.000Z`) : adv.settledAt ?? null,
            notes: settleNote,
          },
        });

        await db.employeeDeduction.create({
          data: {
            tenantId,
            companyId: run.companyId,
            employeeId: item.employeeId,
            deductionType: 'advance',
            amount: new Prisma.Decimal(allocate),
            transactionDate: new Date(`${txDate}T00:00:00.000Z`),
            notes: `خصم سلفة تلقائي من مسير ${run.runNumber} - سلفة ${adv.invoiceNumber}`,
            referenceId: adv.id,
          },
        });

        remainingToDeduct -= allocate;
      }
    }
  }

  /**
   * عكس تسويات السلف المرتبطة بمسيرة (قبل حذف سجل المسيرة).
   * يطابق منطق prisma/delete-payroll-run-company-month.js
   */
  private async reversePayrollAdvanceSettlementsForDelete(
    db: Pick<TenantPrismaService, 'invoice' | 'employeeDeduction'>,
    companyId: string,
    runNumber: string,
  ): Promise<void> {
    const deductions = await db.employeeDeduction.findMany({
      where: {
        companyId,
        deductionType: 'advance',
        notes: { contains: `مسير ${runNumber}` },
      },
    });

    const esc = runNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const advLineRe = new RegExp(`^\\[ADV_PAYROLL\\] run=${esc},`);

    for (const d of deductions) {
      if (!d.referenceId) continue;
      const inv = await db.invoice.findFirst({
        where: { id: d.referenceId, companyId, kind: 'advance' },
      });
      if (!inv) continue;

      const prevSettled = Number(inv.settledAmount ?? 0);
      const deductAmt = Number(d.amount);
      const newSettled = Math.max(0, prevSettled - deductAmt);
      const total = Number(inv.totalAmount ?? 0);
      const newNotes = String(inv.notes || '')
        .split('\n')
        .filter((line) => !advLineRe.test(line.trim()))
        .join('\n')
        .trim();

      const eps = 0.02;
      await db.invoice.update({
        where: { id: inv.id },
        data: {
          settledAmount: new Prisma.Decimal(newSettled),
          settledAt: newSettled >= total - eps ? inv.settledAt : null,
          notes: newNotes || null,
        },
      });
    }

    if (deductions.length) {
      await db.employeeDeduction.deleteMany({
        where: {
          companyId,
          deductionType: 'advance',
          notes: { contains: `مسير ${runNumber}` },
        },
      });
    }
  }

  /** مجموع أجزاء الخزائن يجب أن يطابق صافي المسيرة (مجموع صافي السطور). */
  private assertPayrollRunVaultSplitsMatchTotal(
    splits: Array<{ amount: number | string }>,
    totalAmount: number,
  ): void {
    const EPS = 0.02;
    const sum = splits.reduce((s, x) => s + Number(x.amount), 0);
    if (!Number.isFinite(sum) || !Number.isFinite(totalAmount) || Math.abs(sum - totalAmount) > EPS) {
      throw new BadRequestException(
        `مجموع توزيع الخزائن (${Number(sum).toFixed(2)}) يجب أن يساوي إجمالي صافي المسيرة (${Number(totalAmount).toFixed(2)}).`,
      );
    }
  }

  /** صافي السطر = max(0, إجمالي + بدلات إضافية − خصومات − سلف) — يطابق الواجهة. */
  private assertPayrollItemsNetConsistent(items: PayrollRunItemDto[]): void {
    const EPS = 0.02;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const gross = Number(it.grossSalary);
      const add = Number(it.allowancesAdd ?? 0);
      const ded = Number(it.deductions ?? 0);
      const adv = Number(it.advancesDeduct ?? 0);
      const net = Number(it.netSalary);
      const raw = gross + add - ded - adv;
      const expected = raw < 0 ? 0 : raw;
      if (!Number.isFinite(net) || !Number.isFinite(expected) || Math.abs(net - expected) > EPS) {
        throw new BadRequestException(
          `السطر ${i + 1}: صافي الراتب (${net}) لا يطابق الحساب (المتوقع ≈ ${expected.toFixed(2)}: إجمالي + بدلات إضافية − خصومات − سلف).`,
        );
      }
    }
  }

  async createPayrollRun(dto: CreatePayrollRunDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    this.assertPayrollItemsNetConsistent(dto.items);
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

    const runNumber = await this.generateRunNumber(dto.companyId);

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
    await this.assertVaultsUsableForPayment(dto.companyId, splitVaultIds);
    if (dto.vaultSplits?.length) {
      this.assertPayrollRunVaultSplitsMatchTotal(dto.vaultSplits, totalAmount);
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
      const txDate = this.saudiDateYmd();
      updated = await this.prisma.withTenant(async (tx) => {
        await this.applyPayrollAdvanceSettlements(
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
      this.assertPayrollItemsNetConsistent(dto.items);

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
      await this.assertVaultsUsableForPayment(companyId, splitVaultIds);
      if (dto.vaultSplits?.length) {
        this.assertPayrollRunVaultSplitsMatchTotal(dto.vaultSplits, totalAmount);
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
      await this.assertVaultsUsableForPayment(companyId, splitVaultIds);
      if (dto.vaultSplits.length) {
        this.assertPayrollRunVaultSplitsMatchTotal(dto.vaultSplits, totalAmount);
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
      await this.reversePayrollAdvanceSettlementsForDelete(tx, companyId, existing.runNumber);
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

    const txDate = dto.transactionDate.slice(0, 10);
    const totalStr = String(run.totalAmount);
    const totalDec = new Prisma.Decimal(run.totalAmount);

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
    if (!defaultVault) {
      throw new BadRequestException(
        'لا توجد خزنة نشطة. يرجى تحديد توزيع الخزائن للمسيرة أو إنشاء خزنة.',
      );
    }

    let vaultSplitsOut: Array<{ vaultId: string; amount: string }>;

    // Priority 1: vaultSplits sent from the UI at payment time
    if (dto.vaultSplits?.length) {
      const splitVaultIds = dto.vaultSplits.map((vs) => vs.vaultId);
      await this.assertVaultsUsableForPayment(run.companyId, splitVaultIds);
      this.assertPayrollRunVaultSplitsMatchTotal(
        dto.vaultSplits.map((vs) => ({ vaultId: vs.vaultId, amount: vs.amount })),
        Number(totalDec),
      );
      vaultSplitsOut = dto.vaultSplits.map((vs) => ({
        vaultId: vs.vaultId,
        amount: String(vs.amount),
      }));
    // Priority 2: vaultSplits saved on the run (legacy, kept for backward compat)
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
    // Priority 3: fall back to default vault for full amount
    } else {
      vaultSplitsOut = [{ vaultId: defaultVault.id, amount: totalStr }];
    }

    const dtos = [
      {
        companyId: run.companyId,
        employeeId: undefined as string | undefined,
        invoiceNumber: `SAL-${run.runNumber}`,
        kind: 'salary',
        totalAmount: totalStr,
        netAmount: totalStr,
        taxAmount: '0',
        transactionDate: txDate,
        batchId: run.id,
        vaultSplits: vaultSplitsOut,
        notes: `مسيرة رواتب ${run.runNumber} (${run.employeeCount} موظف)`,
      },
    ];

    const results = await this.financialCore.processOutflowBatch(dtos, userId);

    if (!run.advanceSettlementsAppliedAt) {
      await this.applyPayrollAdvanceSettlements(
        this.prisma,
        {
          companyId: run.companyId,
          runNumber: run.runNumber,
          payrollMonth: run.payrollMonth,
          items: run.items,
        },
        txDate,
        tenantId,
      );
      await this.prisma.payrollRun.update({
        where: { id: run.id },
        data: { advanceSettlementsAppliedAt: new Date() },
      });
    }

    await this.audit.log({
      companyId: run.companyId,
      userId,
      action: 'create',
      entity: 'payroll_payment',
      entityId: run.id,
      newValue: {
        payrollRunId: run.id,
        runNumber: run.runNumber,
        invoiceCount: results.length,
      },
    });

    return {
      payrollRunId: run.id,
      invoicesCreated: results.length,
      invoices: results.map((r) => r.invoice),
    };
  }

  // ══════════════════════════════════════════════════════════
  // ADVANCES (فواتير سلف موظفين)
  // ══════════════════════════════════════════════════════════

  async findAdvanceInvoices(companyId: string, year?: number) {
    const where: Prisma.InvoiceWhereInput = {
      companyId,
      kind: 'advance',
      status: 'active',
    };
    if (year) {
      where.transactionDate = {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      };
    }
    return this.prisma.invoice.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, nameEn: true, employeeSerial: true } },
      },
      orderBy: { transactionDate: 'desc' },
      take: 500,
    });
  }

  // ══════════════════════════════════════════════════════════
  // LEAVES
  // ══════════════════════════════════════════════════════════

  async findLeaves(
    companyId: string,
    employeeId?: string,
    year?: number,
  ) {
    const where: Prisma.LeaveWhereInput = { companyId };
    if (employeeId) where.employeeId = employeeId;
    if (year) {
      where.startDate = {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      };
    }
    return this.prisma.leave.findMany({
      where,
      include: { employee: true, salarySettlement: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async findLeaveSalarySettlements(companyId: string, payrollMonthStr: string) {
    const d = new Date(payrollMonthStr);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('تاريخ شهر المسيرة غير صالح.');
    }
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return this.prisma.leaveSalarySettlement.findMany({
      where: { companyId, payrollMonth: d },
      include: {
        employee: {
          select: { id: true, name: true, nameEn: true, employeeSerial: true },
        },
        leave: { select: { id: true, startDate: true, endDate: true, leaveType: true } },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, transactionDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * معاينة مبلغ تسوية الراتب التقويمي (إجازة سنوية معتمدة، بدون صرف).
   */
  async getLeaveSalarySettlementPreview(leaveId: string, companyId: string) {
    const leave = await this.prisma.leave.findFirst({
      where: { id: leaveId, companyId },
      include: { salarySettlement: true },
    });
    if (!leave) throw new NotFoundException('الإجازة غير موجودة.');
    if (leave.status !== 'approved') {
      throw new BadRequestException('تسوية الراتب متاحة للإجازات المعتمدة فقط.');
    }
    if (leave.leaveType !== 'annual') {
      throw new BadRequestException('تسوية الراتب متاحة لإجازات سنوية فقط.');
    }
    if (leave.salarySettlement) {
      throw new BadRequestException('تم إصدار تسوية راتب لهذه الإجازة مسبقاً.');
    }

    const emp = await this.prisma.employee.findFirst({
      where: { id: leave.employeeId, companyId },
      include: { customAllowances: true },
    });
    if (!emp) throw new BadRequestException('الموظف غير موجود.');

    const customSum = (emp.customAllowances ?? []).reduce(
      (s, r) => s + Number(r.amount ?? 0),
      0,
    );

    const calc = computeCalendarLeaveSalarySettlement(emp, new Date(leave.startDate), customSum);

    if (calc.calendarDaysPaid <= 0 || calc.grossAmount <= 0) {
      throw new BadRequestException(
        'لا يمكن احتساب تسوية راتب — تاريخ بداية الإجازة خارج نطاق العمل في الشهر أو المبلغ صفر.',
      );
    }

    return {
      suggestedAmount: calc.grossAmount,
      payrollMonth: calc.payrollMonth.toISOString(),
      calendarDaysPaid: calc.calendarDaysPaid,
      daysInMonth: calc.daysInMonth,
    };
  }

  /**
   * إصدار تسوية راتب (اختياري) بعد اعتماد إجازة سنوية — يمكن تعديل المبلغ قبل الصرف.
   */
  async issueLeaveSalarySettlement(
    leaveId: string,
    companyId: string,
    dto: IssueLeaveSalarySettlementDto,
    userId?: string,
  ) {
    const leave = await this.prisma.leave.findFirst({
      where: { id: leaveId, companyId, status: 'approved' },
      include: { salarySettlement: true },
    });
    if (!leave) {
      throw new NotFoundException('الإجازة غير موجودة أو ليست معتمدة.');
    }
    if (leave.salarySettlement) {
      throw new BadRequestException('تم إصدار تسوية راتب لهذه الإجازة مسبقاً.');
    }

    await this.issueLeaveSalarySettlementInternal(
      {
        id: leave.id,
        employeeId: leave.employeeId,
        companyId: leave.companyId,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
      },
      userId ?? '',
      { vaultId: dto.vaultId, grossAmountOverride: dto.grossAmount },
    );

    return this.prisma.leave.findFirst({
      where: { id: leaveId },
      include: { employee: true, salarySettlement: true },
    });
  }

  /**
   * صرف تسوية راتب تقويمي + فاتورة + حركة في ملف الموظف.
   * idempotency: لا يُكرَّر إن وُجد سجل تسوية لنفس الإجازة.
   */
  private async issueLeaveSalarySettlementInternal(
    leave: {
      id: string;
      employeeId: string;
      companyId: string;
      leaveType: string;
      startDate: Date;
    },
    userId: string,
    options: { vaultId?: string; grossAmountOverride?: number },
  ): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    if (leave.leaveType !== 'annual') {
      throw new BadRequestException('تسوية الراتب متاحة لإجازات سنوية فقط.');
    }

    const existingSet = await this.prisma.leaveSalarySettlement.findUnique({
      where: { leaveId: leave.id },
    });
    if (existingSet) return;

    const emp = await this.prisma.employee.findFirst({
      where: { id: leave.employeeId, companyId: leave.companyId },
      include: { customAllowances: true },
    });
    if (!emp) throw new BadRequestException('الموظف غير موجود.');
    if (emp.status === 'terminated') {
      throw new BadRequestException('لا يمكن صرف تسوية راتب لموظف منتهي الخدمة.');
    }

    const customSum = (emp.customAllowances ?? []).reduce(
      (s, r) => s + Number(r.amount ?? 0),
      0,
    );

    const calc = computeCalendarLeaveSalarySettlement(emp, new Date(leave.startDate), customSum);

    if (calc.calendarDaysPaid <= 0 || calc.grossAmount <= 0) {
      throw new BadRequestException(
        'لا يمكن احتساب تسوية راتب — تاريخ بداية الإجازة خارج نطاق العمل في الشهر أو المبلغ صفر.',
      );
    }

    let grossFinal = calc.grossAmount;
    if (options.grossAmountOverride != null) {
      const o = Number(options.grossAmountOverride);
      if (!Number.isFinite(o) || o < 0.01) {
        throw new BadRequestException('المبلغ غير صالح.');
      }
      grossFinal = Math.round(o * 100) / 100;
    }

    const { payrollMonth, daysInMonth, calendarDaysPaid } = calc;

    const dup = await this.prisma.leaveSalarySettlement.findFirst({
      where: {
        employeeId: emp.id,
        payrollMonth,
      },
    });
    if (dup) {
      throw new BadRequestException(
        'يوجد بالفعل تسوية راتب لنفس الموظف في نفس الشهر. لا يمكن تكرار الصرف.',
      );
    }

    let vaultIdToUse = options.vaultId;
    if (!vaultIdToUse) {
      const v = await this.prisma.vault.findFirst({
        where: {
          companyId: leave.companyId,
          isActive: true,
          isArchived: false,
          showAsPaymentMethod: true,
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!v) {
        throw new BadRequestException(
          'لا توجد خزنة نشطة. يرجى إنشاء خزنة أو تمرير vaultId.',
        );
      }
      vaultIdToUse = v.id;
    }
    await this.assertVaultsUsableForPayment(leave.companyId, [vaultIdToUse]);

    const txDate = this.saudiDateYmd();
    const amountStr = grossFinal.toFixed(2);
    const ym = `${payrollMonth.getFullYear()}-${String(payrollMonth.getMonth() + 1).padStart(2, '0')}`;
    const sd = new Date(leave.startDate);
    const startStrFormatted = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}`;
    const manualNote =
      options.grossAmountOverride != null
        && Math.abs(grossFinal - calc.grossAmount) > 0.005
        ? ` — معدّل يدوياً (مقترح ${calc.grossAmount.toFixed(2)})`
        : '';
    const notes = `تسوية راتب حتى يوم السفر — إجازة سنوية من ${startStrFormatted} (${calendarDaysPaid}/${daysInMonth} يوم تقويمي، شهر ${ym})${manualNote}`;

    const { invoice } = await this.financialCore.processOutflow(
      {
        companyId: leave.companyId,
        employeeId: emp.id,
        kind: 'salary',
        totalAmount: amountStr,
        netAmount: amountStr,
        taxAmount: '0',
        transactionDate: txDate,
        vaultSplits: [{ vaultId: vaultIdToUse, amount: amountStr }],
        notes,
        idempotencyKey: `leave-salary-settlement:${leave.id}`,
      },
      userId,
    );

    await this.prisma.leaveSalarySettlement.create({
      data: {
        tenantId,
        companyId: leave.companyId,
        leaveId: leave.id,
        employeeId: emp.id,
        payrollMonth,
        invoiceId: invoice.id,
        grossAmount: new Prisma.Decimal(amountStr),
        netAmount: new Prisma.Decimal(amountStr),
        calendarDaysPaid,
        daysInMonth,
        transactionDate: new Date(`${txDate}T00:00:00.000Z`),
      },
    });

    await this.prisma.employeeMovement.create({
      data: {
        tenantId,
        companyId: leave.companyId,
        employeeId: emp.id,
        movementType: 'other',
        amount: toMoneyDecimal2(grossFinal),
        previousValue: null,
        newValue: amountStr,
        effectiveDate: new Date(`${txDate}T00:00:00.000Z`),
        notes: `تسوية راتب إجازة سنوية (تقويمي) — ${calendarDaysPaid}/${daysInMonth} يوم — ${invoice.invoiceNumber}${manualNote}`,
      },
    });
  }

  async deleteLeave(id: string, companyId: string, userId?: string) {
    const existing = await this.prisma.leave.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException(`الإجازة ${id} غير موجودة.`);

    const st = await this.prisma.leaveSalarySettlement.findUnique({
      where: { leaveId: id },
    });
    if (st) {
      throw new BadRequestException(
        'لا يمكن حذف إجازة مرتبطة بتسوية راتب مُصرفة. راجع الفواتير أو المحاسبة.',
      );
    }

    await this.prisma.leave.delete({ where: { id } });

    if (existing.status === 'approved') {
      await this.syncEmployeeLeavePresence(existing.employeeId, companyId);
    }

    await this.audit.log({
      companyId,
      userId,
      action: 'delete',
      entity: 'leave',
      entityId: id,
      oldValue: { leaveType: existing.leaveType, status: existing.status },
    });

    return { deleted: true, id };
  }

  async createLeave(dto: CreateLeaveDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    let daysCount = dto.daysCount;
    if (daysCount == null) {
      const diff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      daysCount = Math.max(1, diff + 1);
    }

    const leave = await this.prisma.leave.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        leaveType: dto.leaveType,
        startDate,
        endDate,
        daysCount,
        status: dto.status ?? 'pending',
        notes: dto.notes,
      },
      include: { employee: true },
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'leave',
      entityId: leave.id,
      newValue: { leaveType: leave.leaveType, daysCount: leave.daysCount },
    });

    return leave;
  }

  async updateLeaveStatus(
    id: string,
    dto: UpdateLeaveStatusDto,
    companyId: string,
    userId?: string,
  ) {
    const existing = await this.prisma.leave.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException(`الإجازة ${id} غير موجودة.`);

    if (dto.status === 'rejected' && existing.status === 'approved') {
      const st = await this.prisma.leaveSalarySettlement.findUnique({
        where: { leaveId: id },
      });
      if (st) {
        throw new BadRequestException(
          'لا يمكن رفض إجازة تم صرف تسوية راتب لها. راجع الفاتورة المالية أو ألغِ العملية من قسم الحسابات عند الحاجة.',
        );
      }
    }

    const transitioningToApproved =
      dto.status === 'approved' && existing.status !== 'approved';

    if (!transitioningToApproved) {
      const updated = await this.prisma.leave.update({
        where: { id },
        data: { status: dto.status },
        include: { employee: true, salarySettlement: true },
      });

      await this.audit.log({
        companyId,
        userId,
        action: 'update',
        entity: 'leave',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: dto.status },
      });

      if (existing.status === 'approved' && dto.status === 'rejected') {
        await this.syncEmployeeLeavePresence(existing.employeeId, companyId);
      }

      return updated;
    }

    const updated = await this.prisma.leave.update({
      where: { id },
      data: { status: 'approved' },
      include: { employee: true, salarySettlement: true },
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'leave',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: dto.status },
    });

    await this.maybeSetEmployeeOnLeaveAfterApproval(
      updated.employeeId,
      updated.companyId,
      updated.startDate,
      updated.endDate,
    );

    return await this.prisma.leave.findFirst({
      where: { id },
      include: { employee: true, salarySettlement: true },
    });
  }

  /**
   * تسجيل عودة من إجازة معتمدة: يحدّث نهاية الإجازة إذا كانت العودة مبكرة، ويضبط حالة الموظف (نشط إن لم تعد هناك إجازة سارية).
   */
  async returnFromLeave(
    id: string,
    dto: ReturnFromLeaveDto,
    companyId: string,
    userId?: string,
  ) {
    const leave = await this.prisma.leave.findFirst({
      where: { id, companyId, status: 'approved' },
    });
    if (!leave) {
      throw new NotFoundException('الإجازة غير موجودة أو ليست معتمدة.');
    }

    const actualYmd = (dto.actualReturnDate?.slice(0, 10) || this.saudiDateYmd()).trim();
    const startYmd = this.dateToSaudiYmd(leave.startDate);
    const endYmdOriginal = this.dateToSaudiYmd(leave.endDate);

    if (actualYmd < startYmd) {
      throw new BadRequestException('تاريخ العودة لا يمكن أن يكون قبل بداية الإجازة.');
    }
    if (actualYmd > endYmdOriginal) {
      throw new BadRequestException('تاريخ العودة لا يمكن أن يكون بعد آخر يوم مسجّل للإجازة.');
    }

    const newEnd = new Date(`${actualYmd}T00:00:00.000Z`);
    const daysCount = this.daysInclusiveBetweenSaudiYmd(startYmd, actualYmd);

    await this.prisma.leave.update({
      where: { id },
      data: { endDate: newEnd, daysCount },
    });

    await this.syncEmployeeLeavePresence(leave.employeeId, companyId);

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'leave',
      entityId: id,
      oldValue: { endDate: leave.endDate, daysCount: leave.daysCount },
      newValue: { endDate: newEnd, daysCount, actualReturnYmd: actualYmd },
    });

    return this.prisma.leave.findFirst({
      where: { id },
      include: { employee: true, salarySettlement: true },
    });
  }

  // ══════════════════════════════════════════════════════════
  // RESIDENCIES
  // ══════════════════════════════════════════════════════════

  async findResidencies(companyId: string, employeeId?: string) {
    const where: Prisma.EmployeeResidencyWhereInput = { companyId };
    if (employeeId) where.employeeId = employeeId;
    return this.prisma.employeeResidency.findMany({
      where,
      include: { employee: true },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async createResidency(dto: CreateResidencyDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const residency = await this.prisma.employeeResidency.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        iqamaNumber: dto.iqamaNumber,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        expiryDate: new Date(dto.expiryDate),
        status: dto.status ?? 'active',
        notes: dto.notes,
      },
      include: { employee: true },
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'employee_residency',
      entityId: residency.id,
      newValue: { iqamaNumber: residency.iqamaNumber },
    });

    return residency;
  }

  async updateResidency(
    id: string,
    dto: UpdateResidencyDto,
    companyId: string,
    userId?: string,
  ) {
    const existing = await this.prisma.employeeResidency.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException(`الإقامة ${id} غير موجودة.`);

    const updated = await this.prisma.employeeResidency.update({
      where: { id },
      data: {
        ...(dto.iqamaNumber !== undefined && { iqamaNumber: dto.iqamaNumber }),
        ...(dto.issueDate !== undefined && { issueDate: new Date(dto.issueDate) }),
        ...(dto.expiryDate !== undefined && { expiryDate: new Date(dto.expiryDate) }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: { employee: true },
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'employee_residency',
      entityId: id,
      oldValue: { iqamaNumber: existing.iqamaNumber },
      newValue: { iqamaNumber: updated.iqamaNumber },
    });

    return updated;
  }

  async deleteResidency(id: string, companyId: string, userId?: string) {
    const existing = await this.prisma.employeeResidency.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException(`الإقامة ${id} غير موجودة.`);

    await this.prisma.employeeResidency.delete({ where: { id } });

    await this.audit.log({
      companyId,
      userId,
      action: 'delete',
      entity: 'employee_residency',
      entityId: id,
      oldValue: { iqamaNumber: existing.iqamaNumber },
    });

    return { deleted: true, id };
  }

  // ══════════════════════════════════════════════════════════
  // DOCUMENTS
  // ══════════════════════════════════════════════════════════

  async findDocuments(
    companyId: string,
    employeeId?: string,
  ) {
    const where: Prisma.EmployeeDocumentWhereInput = { companyId };
    if (employeeId) where.employeeId = employeeId;
    return this.prisma.employeeDocument.findMany({
      where,
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocument(dto: CreateDocumentDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const doc = await this.prisma.employeeDocument.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        documentType: dto.documentType,
        fileName: dto.fileName,
        filePath: dto.filePath,
        fileSize: dto.fileSize,
        notes: dto.notes,
      },
      include: { employee: true },
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'employee_document',
      entityId: doc.id,
      newValue: { documentType: doc.documentType, fileName: doc.fileName },
    });

    return doc;
  }

  async uploadDocument(
    companyId: string,
    employeeId: string,
    documentType: 'contract' | 'certificate' | 'iqama' | 'other',
    fileName: string,
    filePath: string,
    fileSize: number,
    userId?: string,
  ) {
    return this.createDocument(
      {
        companyId,
        employeeId,
        documentType,
        fileName,
        filePath,
        fileSize,
      },
      userId,
    );
  }

  async findDocumentById(id: string, companyId: string) {
    const doc = await this.prisma.employeeDocument.findFirst({
      where: { id, companyId },
      include: { employee: true },
    });
    if (!doc) throw new NotFoundException(`المستند ${id} غير موجود.`);
    return doc;
  }

  async deleteDocument(id: string, companyId: string, userId?: string) {
    const existing = await this.prisma.employeeDocument.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException(`المستند ${id} غير موجود.`);

    await this.prisma.employeeDocument.delete({ where: { id } });

    await this.audit.log({
      companyId,
      userId,
      action: 'delete',
      entity: 'employee_document',
      entityId: id,
      oldValue: { fileName: existing.fileName },
    });

    return { deleted: true, id };
  }

  // ══════════════════════════════════════════════════════════
  // MOVEMENTS
  // ══════════════════════════════════════════════════════════

  async findMovements(companyId: string, employeeId?: string) {
    const where: Prisma.EmployeeMovementWhereInput = { companyId };
    if (employeeId) where.employeeId = employeeId;
    return this.prisma.employeeMovement.findMany({
      where,
      include: { employee: true },
      orderBy: { effectiveDate: 'desc' },
    });
  }

  async createMovement(dto: CreateMovementDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const movement = await this.prisma.employeeMovement.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        movementType: dto.movementType,
        amount: dto.amount != null ? new Prisma.Decimal(dto.amount) : null,
        previousValue: dto.previousValue,
        newValue: dto.newValue,
        effectiveDate: new Date(dto.effectiveDate),
        notes: dto.notes,
      },
      include: { employee: true },
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'employee_movement',
      entityId: movement.id,
      newValue: { movementType: movement.movementType },
    });

    return movement;
  }

  // ══════════════════════════════════════════════════════════
  // ALLOWANCES
  // ══════════════════════════════════════════════════════════

  async findAllowances(companyId: string, employeeId?: string) {
    const where: Prisma.EmployeeCustomAllowanceWhereInput = { companyId };
    if (employeeId) where.employeeId = employeeId;
    return this.prisma.employeeCustomAllowance.findMany({
      where,
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAllowance(dto: CreateAllowanceDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const allowance = await this.prisma.employeeCustomAllowance.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        nameAr: dto.nameAr,
        amount: toMoneyDecimal2(dto.amount),
      },
      include: { employee: true },
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'employee_custom_allowance',
      entityId: allowance.id,
      newValue: { nameAr: allowance.nameAr, amount: String(allowance.amount) },
    });

    return allowance;
  }

  async deleteAllowance(id: string, companyId: string, userId?: string) {
    const existing = await this.prisma.employeeCustomAllowance.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException(`البدلة ${id} غير موجودة.`);

    await this.prisma.employeeCustomAllowance.delete({ where: { id } });

    await this.audit.log({
      companyId,
      userId,
      action: 'delete',
      entity: 'employee_custom_allowance',
      entityId: id,
      oldValue: { nameAr: existing.nameAr },
    });

    return { deleted: true, id };
  }

  // ══════════════════════════════════════════════════════════
  // DEDUCTIONS
  // ══════════════════════════════════════════════════════════

  async findDeductions(companyId: string, employeeId?: string) {
    const where: Prisma.EmployeeDeductionWhereInput = { companyId };
    if (employeeId) where.employeeId = employeeId;
    return this.prisma.employeeDeduction.findMany({
      where,
      include: { employee: true },
      orderBy: { transactionDate: 'desc' },
    });
  }

  async createDeduction(dto: CreateDeductionDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const deduction = await this.prisma.employeeDeduction.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        deductionType: dto.deductionType,
        amount: new Prisma.Decimal(dto.amount),
        transactionDate: new Date(dto.transactionDate),
        notes: dto.notes,
        referenceId: dto.referenceId,
      },
      include: { employee: true },
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'employee_deduction',
      entityId: deduction.id,
      newValue: { deductionType: deduction.deductionType, amount: String(deduction.amount) },
    });

    return deduction;
  }
}
