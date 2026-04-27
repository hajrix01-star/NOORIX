import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { toYmd } from '../common/utils/to-ymd.util';
import {
  saudiDateYmd,
  dateToSaudiYmd,
  daysInclusiveBetweenSaudiYmd,
} from './utils/hr-saudi-dates.util';
import type { ReturnFromLeaveDto } from './dto/return-from-leave.dto';
import { syncEmployeeLeavePresence } from './hr-leave-employee-presence-sync.util';

/** تسجيل عودة من إجازة معتمدة: يحدّث نهاية الإجازة إذا كانت العودة مبكرة، ويضبط حالة الموظف. */
export async function returnFromLeaveCore(
  prisma: TenantPrismaService,
  audit: AuditLogService,
  id: string,
  dto: ReturnFromLeaveDto,
  companyId: string,
  userId?: string,
) {
  const leave = await prisma.leave.findFirst({
    where: { id, companyId, status: 'approved' },
  });
  if (!leave) {
    throw new NotFoundException('الإجازة غير موجودة أو ليست معتمدة.');
  }

  const actualYmd = toYmd(dto.actualReturnDate) || saudiDateYmd();
  const startYmd = dateToSaudiYmd(leave.startDate);
  const endYmdOriginal = dateToSaudiYmd(leave.endDate);

  if (actualYmd < startYmd) {
    throw new BadRequestException('تاريخ العودة لا يمكن أن يكون قبل بداية الإجازة.');
  }
  if (actualYmd > endYmdOriginal) {
    throw new BadRequestException('تاريخ العودة لا يمكن أن يكون بعد آخر يوم مسجّل للإجازة.');
  }

  const newEnd = new Date(`${actualYmd}T00:00:00.000Z`);
  const daysCount = daysInclusiveBetweenSaudiYmd(startYmd, actualYmd);

  await prisma.leave.update({
    where: { id },
    data: { endDate: newEnd, daysCount },
  });

  await syncEmployeeLeavePresence(prisma, leave.employeeId, companyId);

  await audit.log({
    companyId,
    userId,
    action: 'update',
    entity: 'leave',
    entityId: id,
    oldValue: { endDate: leave.endDate, daysCount: leave.daysCount },
    newValue: { endDate: newEnd, daysCount, actualReturnYmd: actualYmd },
  });

  return prisma.leave.findFirst({
    where: { id },
    include: { employee: true, salarySettlement: true },
  });
}
