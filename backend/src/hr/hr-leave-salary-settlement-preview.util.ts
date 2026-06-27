import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  computeCalendarLeaveSalarySettlement,
  isPayableLeaveSalarySettlement,
} from './utils/leave-salary-settlement.util';
import { HrCompensationSnapshotService } from './hr-compensation-snapshot.service';

/**
 * معاينة مبلغ تسوية الراتب التقويمي (إجازة سنوية معتمدة، بدون صرف).
 */
export async function getLeaveSalarySettlementPreviewCore(
  prisma: TenantPrismaService,
  compensationSnapshot: HrCompensationSnapshotService,
  leaveId: string,
  companyId: string,
) {
  const leave = await prisma.leave.findFirst({
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

  const emp = await prisma.employee.findFirst({
    where: { id: leave.employeeId, companyId },
  });
  if (!emp) throw new BadRequestException('الموظف غير موجود.');

  const snapshot = await compensationSnapshot.getEmployeeSnapshot(companyId, leave.employeeId);
  const monthlyPackageTotal = Number(snapshot?.salaryPackage?.total);
  if (!Number.isFinite(monthlyPackageTotal) || monthlyPackageTotal <= 0) {
    throw new BadRequestException('تعذر تحميل إجمالي راتب الموظف من المصدر المركزي.');
  }

  const calc = computeCalendarLeaveSalarySettlement(emp, new Date(leave.startDate), monthlyPackageTotal);

  if (!isPayableLeaveSalarySettlement(calc)) {
    throw new BadRequestException(
      'لا يمكن احتساب تسوية راتب — تاريخ بداية الإجازة خارج نطاق العمل في الشهر أو المبلغ صفر.',
    );
  }

  return {
    suggestedAmount: calc.grossAmount,
    payrollMonth: calc.payrollMonth.toISOString(),
    calendarDaysPaid: calc.calendarDaysPaid,
    daysInMonth: calc.daysInMonth,
    monthlyPackageTotal,
    compensationSnapshot: {
      source: snapshot.source,
      calculatedAt: snapshot.calculatedAt,
      salaryPackage: snapshot.salaryPackage,
    },
  };
}
