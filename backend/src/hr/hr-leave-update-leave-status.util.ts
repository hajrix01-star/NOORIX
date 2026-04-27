import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import type { UpdateLeaveStatusDto } from './dto/create-leave.dto';
import { voidLeaveSalarySettlementCore } from './hr-leave-void-salary-settlement.util';
import {
  maybeSetEmployeeOnLeaveAfterApproval,
  syncEmployeeLeavePresence,
} from './hr-leave-employee-presence-sync.util';

export async function updateLeaveStatusCore(
  deps: {
    prisma: TenantPrismaService;
    financialCore: FinancialCoreService;
    audit: AuditLogService;
  },
  id: string,
  dto: UpdateLeaveStatusDto,
  companyId: string,
  userId?: string,
) {
  const { prisma, financialCore, audit } = deps;
  const existing = await prisma.leave.findFirst({
    where: { id, companyId },
  });
  if (!existing) throw new NotFoundException(`الإجازة ${id} غير موجودة.`);

  if (dto.status === 'rejected' && existing.status === 'approved') {
    const st = await prisma.leaveSalarySettlement.findUnique({
      where: { leaveId: id },
    });
    if (st) {
      if (dto.voidSalarySettlement === true) {
        await voidLeaveSalarySettlementCore(
          { prisma, financialCore, audit },
          id,
          companyId,
          userId,
          'رفض إجازة بعد تسوية راتب — إلغاء التسوية بموافقة المستخدم',
        );
      } else {
        throw new BadRequestException(
          'لا يمكن رفض إجازة تم صرف تسوية راتب لها إلا بإلغاء التسوية: أرسل voidSalarySettlement: true بعد تأكيد المستخدم.',
        );
      }
    }
  }

  const transitioningToApproved =
    dto.status === 'approved' && existing.status !== 'approved';

  if (!transitioningToApproved) {
    const updated = await prisma.leave.update({
      where: { id },
      data: { status: dto.status },
      include: { employee: true, salarySettlement: true },
    });

    await audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'leave',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: dto.status },
    });

    if (existing.status === 'approved' && dto.status === 'rejected') {
      await syncEmployeeLeavePresence(prisma, existing.employeeId, companyId);
    }

    return updated;
  }

  const updated = await prisma.leave.update({
    where: { id },
    data: { status: 'approved' },
    include: { employee: true, salarySettlement: true },
  });

  await audit.log({
    companyId,
    userId,
    action: 'update',
    entity: 'leave',
    entityId: id,
    oldValue: { status: existing.status },
    newValue: { status: dto.status },
  });

  await maybeSetEmployeeOnLeaveAfterApproval(
    prisma,
    updated.employeeId,
    updated.companyId,
    updated.startDate,
    updated.endDate,
  );

  return await prisma.leave.findFirst({
    where: { id },
    include: { employee: true, salarySettlement: true },
  });
}
