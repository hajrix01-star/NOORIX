import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  computeCalendarLeaveSalarySettlement,
  isPayableLeaveSalarySettlement,
  sumCustomAllowanceAmounts,
} from './utils/leave-salary-settlement.util';

/**
 * معاينة مبلغ تسوية الراتب التقويمي (إجازة سنوية معتمدة، بدون صرف).
 */
export async function getLeaveSalarySettlementPreviewCore(
  prisma: TenantPrismaService,
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
    include: { customAllowances: true },
  });
  if (!emp) throw new BadRequestException('الموظف غير موجود.');

  const customSum = sumCustomAllowanceAmounts(emp.customAllowances);

  const calc = computeCalendarLeaveSalarySettlement(emp, new Date(leave.startDate), customSum);

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
  };
}
