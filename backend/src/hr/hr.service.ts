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

  async findPayrollRunById(id: string, companyId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, companyId },
      include: {
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

  async createPayrollRun(dto: CreatePayrollRunDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const payrollMonth = new Date(dto.payrollMonth);
    payrollMonth.setDate(1);
    payrollMonth.setHours(0, 0, 0, 0);

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
      vaultSplits?: { vaultId: string; amount: Prisma.Decimal }[];
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
        vaultSplits: item.vaultSplits?.map((vs) => ({
          vaultId: vs.vaultId,
          amount: new Prisma.Decimal(vs.amount),
        })),
      });
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
            vaultSplits: it.vaultSplits?.length
              ? { create: it.vaultSplits.map((vs) => ({ vaultId: vs.vaultId, amount: vs.amount })) }
              : undefined,
          })),
        },
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
    });
    if (!existing) throw new NotFoundException(`مسيرة الرواتب ${id} غير موجودة.`);

    const updated = await this.prisma.payrollRun.update({
      where: { id },
      data: { status: dto.status },
    });

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
    });
    if (!existing) throw new NotFoundException(`مسيرة الرواتب ${id} غير موجودة.`);
    if (existing.status === 'completed') {
      throw new BadRequestException('لا يمكن تعديل مسيرة مكتملة.');
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id },
      data: { ...(dto.notes !== undefined && { notes: dto.notes }) },
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'payroll_run',
      entityId: id,
      oldValue: { notes: existing.notes },
      newValue: { notes: updated.notes },
    });

    return updated;
  }

  async deletePayrollRun(id: string, companyId: string, userId?: string) {
    const existing = await this.prisma.payrollRun.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException(`مسيرة الرواتب ${id} غير موجودة.`);
    if (existing.status === 'completed') {
      throw new BadRequestException('لا يمكن حذف مسيرة مكتملة.');
    }

    await this.prisma.payrollRun.delete({ where: { id } });

    await this.audit.log({
      companyId,
      userId,
      action: 'delete',
      entity: 'payroll_run',
      entityId: id,
      oldValue: { runNumber: existing.runNumber },
    });

    return { deleted: true, id };
  }

  async issuePayrollPayment(dto: IssuePayrollPaymentDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: dto.payrollRunId },
      include: {
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
    const outflows: Array<{
      companyId: string;
      employeeId: string;
      invoiceNumber: string;
      kind: string;
      totalAmount: string;
      netAmount: string;
      taxAmount: string;
      transactionDate: string;
      vaultId?: string;
      batchId?: string;
      notes?: string;
    }> = [];

    let invSeq = 0;
    for (const item of run.items) {
      const netStr = String(item.netSalary);
      if (item.vaultSplits?.length) {
        for (const vs of item.vaultSplits) {
          const amt = String(vs.amount);
          if (Number(amt) <= 0) continue;
          invSeq++;
          outflows.push({
            companyId: run.companyId,
            employeeId: item.employeeId,
            invoiceNumber: `SAL-${run.runNumber}-${String(invSeq).padStart(3, '0')}`,
            kind: 'salary',
            totalAmount: amt,
            netAmount: amt,
            taxAmount: '0',
            transactionDate: txDate,
            vaultId: vs.vaultId,
            batchId: run.id,
            notes: `راتب ${item.employee?.name ?? ''} - ${run.runNumber}`,
          });
        }
      } else {
        const defaultVault = await this.prisma.vault.findFirst({
          where: { companyId: run.companyId, isActive: true, isArchived: false },
          select: { id: true },
        });
        if (!defaultVault) {
          throw new BadRequestException('لا توجد خزنة نشطة. يرجى تحديد توزيع الخزائن للمسيرة أو إنشاء خزنة.');
        }
        invSeq++;
        outflows.push({
          companyId: run.companyId,
          employeeId: item.employeeId,
          invoiceNumber: `SAL-${run.runNumber}-${String(invSeq).padStart(3, '0')}`,
          kind: 'salary',
          totalAmount: netStr,
          netAmount: netStr,
          taxAmount: '0',
          transactionDate: txDate,
          vaultId: defaultVault.id,
          batchId: run.id,
          notes: `راتب ${item.employee?.name ?? ''} - ${run.runNumber}`,
        });
      }
    }

    const dtos = outflows.map((o) => ({
      companyId: o.companyId,
      employeeId: o.employeeId,
      invoiceNumber: o.invoiceNumber,
      kind: o.kind,
      totalAmount: o.totalAmount,
      netAmount: o.netAmount,
      taxAmount: o.taxAmount,
      transactionDate: o.transactionDate,
      vaultId: o.vaultId,
      batchId: o.batchId,
      notes: o.notes,
    }));

    const results = await this.financialCore.processOutflowBatch(dtos, userId);

    const runMonth = `${run.payrollMonth.getFullYear()}-${String(run.payrollMonth.getMonth() + 1).padStart(2, '0')}`;
    const parseDeferredMonth = (notes?: string | null) => {
      const m = String(notes || '').match(/\[ADV_DEFER\]\s*(\d{4}-\d{2})/);
      return m ? m[1] : '';
    };

    for (const item of run.items) {
      let remainingToDeduct = Number(item.advancesDeduct ?? 0);
      if (remainingToDeduct <= 0) continue;

      const advances = await this.prisma.invoice.findMany({
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
        const deferMonth = parseDeferredMonth(adv.notes);
        if (deferMonth && deferMonth === runMonth) continue;

        const total = Number(adv.totalAmount ?? 0);
        const settled = Number(adv.settledAmount ?? 0);
        const remaining = Math.max(0, total - settled);
        if (remaining <= 0) continue;

        const allocate = Math.min(remainingToDeduct, remaining);
        const newSettled = settled + allocate;
        const fullySettled = newSettled >= total;
        const settleNote = `${adv.notes || ''}\n[ADV_PAYROLL] run=${run.runNumber}, amount=${allocate}, date=${txDate}`.trim();

        await this.prisma.invoice.update({
          where: { id: adv.id },
          data: {
            settledAmount: new Prisma.Decimal(newSettled),
            settledAt: fullySettled ? new Date(`${txDate}T00:00:00.000Z`) : adv.settledAt ?? null,
            notes: settleNote,
          },
        });

        await this.prisma.employeeDeduction.create({
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
      include: { employee: true },
      orderBy: { startDate: 'desc' },
    });
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

    const updated = await this.prisma.leave.update({
      where: { id },
      data: { status: dto.status },
      include: { employee: true },
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

    return updated;
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
        amount: new Prisma.Decimal(dto.amount),
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
