/**
 * HrLeaveService — الإجازات وتسويات راتب الإجازة
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { TenantContext } from '../common/tenant-context';
import type { CreateLeaveDto, UpdateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';
import type { ReturnFromLeaveDto } from './dto/return-from-leave.dto';
import type { IssueLeaveSalarySettlementDto } from './dto/issue-leave-salary-settlement.dto';
import { issueLeaveSalarySettlementCore } from './hr-leave-salary-settlement-issue.util';
import { getLeaveSalarySettlementPreviewCore } from './hr-leave-salary-settlement-preview.util';
import { voidLeaveSalarySettlementCore } from './hr-leave-void-salary-settlement.util';
import { syncEmployeeLeavePresence } from './hr-leave-employee-presence-sync.util';
import { returnFromLeaveCore } from './hr-leave-return-from-leave.util';
import { updateLeaveStatusCore } from './hr-leave-update-leave-status.util';

@Injectable()
export class HrLeaveService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
    private readonly financialCore: FinancialCoreService,
  ) {}

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
    return getLeaveSalarySettlementPreviewCore(this.prisma, leaveId, companyId);
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

    await issueLeaveSalarySettlementCore(
      { prisma: this.prisma, financialCore: this.financialCore },
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

  async deleteLeave(
    id: string,
    companyId: string,
    userId?: string,
    voidSettlement?: boolean,
  ) {
    const existing = await this.prisma.leave.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException(`الإجازة ${id} غير موجودة.`);

    const st = await this.prisma.leaveSalarySettlement.findUnique({
      where: { leaveId: id },
    });
    if (st) {
      if (voidSettlement) {
        await voidLeaveSalarySettlementCore(
          { prisma: this.prisma, financialCore: this.financialCore, audit: this.audit },
          id,
          companyId,
          userId,
          'حذف إجازة مرتبطة بتسوية راتب — إلغاء التسوية بموافقة المستخدم',
        );
      } else {
        throw new BadRequestException(
          'لا يمكن حذف إجازة مرتبطة بتسوية راتب مُصرفة. أرسل voidSettlement=true بعد تأكيد إلغاء التسوية، أو ألغِ الفاتورة من قسم الحسابات.',
        );
      }
    }

    await this.prisma.leave.delete({ where: { id } });

    if (existing.status === 'approved') {
      await syncEmployeeLeavePresence(this.prisma, existing.employeeId, companyId);
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
        /** افتراضي: معتمد — مسار المالك الواحد دون خطوة اعتماد منفصلة */
        status: dto.status ?? 'approved',
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

    if (leave.status === 'approved') {
      await syncEmployeeLeavePresence(this.prisma, leave.employeeId, dto.companyId);
    }

    return leave;
  }

  /**
   * تعديل إجازة (معتمدة أو غير معتمدة).
   * إن وُجدت تسوية راتب: تعديل الملاحظات فقط مسموح دون لمس التسوية؛ أي تغيير جوهري يتطلب voidSalarySettlement: true.
   */
  async updateLeave(
    id: string,
    dto: UpdateLeaveDto,
    companyId: string,
    userId?: string,
  ) {
    const existing = await this.prisma.leave.findFirst({
      where: { id, companyId },
      include: { salarySettlement: true },
    });
    if (!existing) {
      throw new NotFoundException(`الإجازة ${id} غير موجودة.`);
    }
    if (existing.salarySettlement) {
      const structural =
        dto.leaveType != null ||
        dto.startDate != null ||
        dto.endDate != null ||
        dto.daysCount != null ||
        dto.status != null ||
        dto.employeeId != null;
      if (structural && dto.voidSalarySettlement !== true) {
        throw new BadRequestException(
          'تعديل إجازة لها تسوية راتب صادرة يتطلب إلغاء التسوية أولاً: أرسل voidSalarySettlement: true بعد تأكيد المستخدم (يُلغى صرف الراتب وعكس القيود ثم يُحذف سجل التسوية).',
        );
      }
      if (structural && dto.voidSalarySettlement === true) {
        await voidLeaveSalarySettlementCore(
            { prisma: this.prisma, financialCore: this.financialCore, audit: this.audit },
            id,
            companyId,
            userId,
            'تعديل إجازة بعد تسوية راتب — إلغاء التسوية بموافقة المستخدم',
          );
      }
    }

    const hasAny =
      dto.leaveType != null ||
      dto.startDate != null ||
      dto.endDate != null ||
      dto.daysCount != null ||
      dto.status != null ||
      dto.notes !== undefined ||
      dto.employeeId != null;
    if (!hasAny) {
      throw new BadRequestException('لا يوجد حقول للتحديث.');
    }

    if (dto.employeeId != null && dto.employeeId !== existing.employeeId) {
      const emp = await this.prisma.employee.findFirst({
        where: { id: dto.employeeId, companyId },
        select: { id: true },
      });
      if (!emp) {
        throw new BadRequestException('الموظف غير موجود أو لا ينتمي لهذه الشركة.');
      }
    }

    const startDate =
      dto.startDate != null ? new Date(dto.startDate) : existing.startDate;
    const endDate =
      dto.endDate != null ? new Date(dto.endDate) : existing.endDate;
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException(
        'تاريخ نهاية الإجازة يجب أن يكون بعد تاريخ البداية.',
      );
    }

    let daysCount = existing.daysCount;
    if (dto.daysCount != null) {
      daysCount = dto.daysCount;
    } else if (dto.startDate != null || dto.endDate != null) {
      const diff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      daysCount = Math.max(1, diff + 1);
    }

    const data: Prisma.LeaveUpdateInput = {};
    if (dto.leaveType != null) data.leaveType = dto.leaveType;
    if (dto.startDate != null) data.startDate = startDate;
    if (dto.endDate != null) data.endDate = endDate;
    if (
      dto.daysCount != null ||
      dto.startDate != null ||
      dto.endDate != null
    ) {
      data.daysCount = daysCount;
    }
    if (dto.status != null) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.employeeId != null) {
      data.employee = { connect: { id: dto.employeeId } };
    }

    const updated = await this.prisma.leave.update({
      where: { id },
      data,
      include: { employee: true, salarySettlement: true },
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'leave',
      entityId: id,
      oldValue: {
        leaveType: existing.leaveType,
        startDate: existing.startDate,
        endDate: existing.endDate,
        daysCount: existing.daysCount,
        status: existing.status,
        employeeId: existing.employeeId,
      },
      newValue: {
        leaveType: updated.leaveType,
        startDate: updated.startDate,
        endDate: updated.endDate,
        daysCount: updated.daysCount,
        status: updated.status,
        employeeId: updated.employeeId,
      },
    });

    const toSync = new Set<string>();
    toSync.add(existing.employeeId);
    if (updated.employeeId !== existing.employeeId) {
      toSync.add(updated.employeeId);
    }
    for (const eid of toSync) {
      await syncEmployeeLeavePresence(this.prisma, eid, companyId);
    }

    return updated;
  }

  async updateLeaveStatus(
    id: string,
    dto: UpdateLeaveStatusDto,
    companyId: string,
    userId?: string,
  ) {
    return updateLeaveStatusCore(
      {
        prisma: this.prisma,
        financialCore: this.financialCore,
        audit: this.audit,
      },
      id,
      dto,
      companyId,
      userId,
    );
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
    return returnFromLeaveCore(this.prisma, this.audit, id, dto, companyId, userId);
  }
}
