import { BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import { AuditLogService } from '../audit/audit-log.service';

/**
 * إلغاء تسوية راتب الإجازة: حذف سجل التسوية + حركة ملف الموظف، ثم إلغاء الفاتورة وعكس القيود.
 */
export async function voidLeaveSalarySettlementCore(
  deps: {
    prisma: TenantPrismaService;
    accountingCore: AccountingCoreService;
    audit: AuditLogService;
  },
  leaveId: string,
  companyId: string,
  userId: string | undefined,
  reason: string,
): Promise<void> {
  const { prisma, accountingCore, audit } = deps;
  const st = await prisma.leaveSalarySettlement.findUnique({
    where: { leaveId },
  });
  if (!st) return;

  const inv = await prisma.invoice.findFirst({
    where: { id: st.invoiceId, companyId },
  });
  if (!inv) {
    throw new BadRequestException('فاتورة تسوية الراتب غير موجودة — يتطلب مراجعة يدوية.');
  }
  const invoiceId = st.invoiceId;
  const invoiceNum = inv.invoiceNumber;
  const employeeId = st.employeeId;

  await prisma.$transaction(async (tx) => {
    await tx.leaveSalarySettlement.delete({ where: { leaveId } });
    if (invoiceNum) {
      await tx.employeeMovement.deleteMany({
        where: {
          companyId,
          employeeId,
          movementType: 'other',
          notes: { contains: invoiceNum },
        },
      });
    }
  });

  await accountingCore.reverseFinancialOperation(
    {
      companyId,
      referenceType: 'salary',
      referenceId: invoiceId,
      reason,
    },
    userId,
  );

  await audit.log({
    companyId,
    userId,
    action: 'update',
    entity: 'leave',
    entityId: leaveId,
    oldValue: { voidedSalarySettlement: true, invoiceId },
    newValue: { reason },
  });
}
