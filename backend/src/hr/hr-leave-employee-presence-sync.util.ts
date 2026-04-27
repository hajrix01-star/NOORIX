import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  saudiDateYmd,
  isSaudiYmdInLeaveRange,
} from './utils/hr-saudi-dates.util';

export async function syncEmployeeLeavePresence(
  prisma: TenantPrismaService,
  employeeId: string,
  companyId: string,
): Promise<void> {
  const today = saudiDateYmd();
  const leaves = await prisma.leave.findMany({
    where: { employeeId, companyId, status: 'approved' },
    select: { startDate: true, endDate: true },
  });
  const anyInRange = leaves.some((l) => isSaudiYmdInLeaveRange(today, l.startDate, l.endDate));
  if (anyInRange) {
    await prisma.employee.updateMany({
      where: { id: employeeId, companyId, status: { in: ['active', 'on_leave'] } },
      data: { status: 'on_leave' },
    });
  } else {
    await prisma.employee.updateMany({
      where: { id: employeeId, companyId, status: 'on_leave' },
      data: { status: 'active' },
    });
  }
}

export async function maybeSetEmployeeOnLeaveAfterApproval(
  prisma: TenantPrismaService,
  employeeId: string,
  companyId: string,
  startDate: Date,
  endDate: Date,
): Promise<void> {
  const today = saudiDateYmd();
  if (!isSaudiYmdInLeaveRange(today, startDate, endDate)) return;
  await prisma.employee.updateMany({
    where: { id: employeeId, companyId, status: { in: ['active', 'on_leave'] } },
    data: { status: 'on_leave' },
  });
}
