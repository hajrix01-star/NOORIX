import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { TenantContext } from '../common/tenant-context';
import { toMoneyDecimal2 } from '../common/utils/money-decimal';
import {
  computeCalendarLeaveSalarySettlement,
  isPayableLeaveSalarySettlement,
  resolveLeaveSalarySettlementGrossAmount,
} from './utils/leave-salary-settlement.util';
import { assertVaultsUsableForPayment } from '../vaults/assert-vaults-for-payment.util';
import { saudiDateYmd } from './utils/hr-saudi-dates.util';
import { HrCompensationSnapshotService } from './hr-compensation-snapshot.service';

export type LeaveForSalarySettlement = {
  id: string;
  employeeId: string;
  companyId: string;
  leaveType: string;
  startDate: Date;
};

/**
 * صرف تسوية راتب تقويمي + فاتورة + حركة في ملف الموظف.
 * idempotency: لا يُكرَّر إن وُجد سجل تسوية لنفس الإجازة.
 */
export async function issueLeaveSalarySettlementCore(
  deps: {
    prisma: TenantPrismaService;
    financialCore: FinancialCoreService;
    compensationSnapshot: HrCompensationSnapshotService;
  },
  leave: LeaveForSalarySettlement,
  userId: string,
  options: { vaultId?: string; grossAmountOverride?: number },
): Promise<void> {
  const { prisma, financialCore, compensationSnapshot } = deps;
  const tenantId = TenantContext.getTenantId();
  if (leave.leaveType !== 'annual') {
    throw new BadRequestException('تسوية الراتب متاحة لإجازات سنوية فقط.');
  }

  const existingSet = await prisma.leaveSalarySettlement.findUnique({
    where: { leaveId: leave.id },
  });
  if (existingSet) return;

  const emp = await prisma.employee.findFirst({
    where: { id: leave.employeeId, companyId: leave.companyId },
  });
  if (!emp) throw new BadRequestException('الموظف غير موجود.');
  if (emp.status === 'terminated') {
    throw new BadRequestException('لا يمكن صرف تسوية راتب لموظف منتهي الخدمة.');
  }

  const snapshot = await compensationSnapshot.getEmployeeSnapshot(leave.companyId, leave.employeeId);
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

  let grossFinal = calc.grossAmount;
  let hasManualOverride = false;
  if (options.grossAmountOverride != null) {
    let resolvedGross: { grossAmount: number; hasManualOverride: boolean };
    try {
      resolvedGross = resolveLeaveSalarySettlementGrossAmount(calc, options.grossAmountOverride);
    } catch {
      throw new BadRequestException('المبلغ غير صالح.');
    }
    grossFinal = resolvedGross.grossAmount;
    hasManualOverride = resolvedGross.hasManualOverride;
  }

  const { payrollMonth, daysInMonth, calendarDaysPaid } = calc;

  const dup = await prisma.leaveSalarySettlement.findFirst({
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
    const v = await prisma.vault.findFirst({
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
      throw new BadRequestException('لا توجد خزنة نشطة. يرجى إنشاء خزنة أو تمرير vaultId.');
    }
    vaultIdToUse = v.id;
  }
  await assertVaultsUsableForPayment(prisma, leave.companyId, [vaultIdToUse]);

  const txDate = saudiDateYmd();
  const amountStr = grossFinal.toFixed(2);
  const ym = `${payrollMonth.getFullYear()}-${String(payrollMonth.getMonth() + 1).padStart(2, '0')}`;
  const sd = new Date(leave.startDate);
  const startStrFormatted = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}`;
  const manualNote =
    hasManualOverride
      ? ` — معدّل يدوياً (مقترح ${calc.grossAmount.toFixed(2)})`
      : '';
  const notes = `تسوية راتب حتى يوم السفر — إجازة سنوية من ${startStrFormatted} (${calendarDaysPaid}/${daysInMonth} يوم تقويمي، شهر ${ym})${manualNote}`;
  const snapshotNote = ` [HR_COMP_SNAPSHOT:${snapshot.calculatedAt}:monthly=${monthlyPackageTotal.toFixed(2)}]`;

  const { invoice } = await financialCore.processOutflow(
    {
      companyId: leave.companyId,
      employeeId: emp.id,
      kind: 'salary',
      totalAmount: amountStr,
      netAmount: amountStr,
      taxAmount: '0',
      transactionDate: txDate,
      vaultSplits: [{ vaultId: vaultIdToUse, amount: amountStr }],
      notes: `${notes}${snapshotNote}`.slice(0, 2000),
      idempotencyKey: `leave-salary-settlement:${leave.id}`,
    },
    userId,
  );

  await prisma.leaveSalarySettlement.create({
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

  await prisma.employeeMovement.create({
    data: {
      tenantId,
      companyId: leave.companyId,
      employeeId: emp.id,
      movementType: 'other',
      amount: toMoneyDecimal2(grossFinal),
      previousValue: null,
      newValue: amountStr,
      effectiveDate: new Date(`${txDate}T00:00:00.000Z`),
      notes: `تسوية راتب إجازة سنوية (تقويمي) — ${calendarDaysPaid}/${daysInMonth} يوم — ${invoice.invoiceNumber}${manualNote}${snapshotNote}`.slice(0, 2000),
    },
  });
}
