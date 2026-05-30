import { BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { AuditLogService } from '../audit/audit-log.service';

/**
 * إلغاء فاتورة خدمة موظف مرتبطة بسجل إقامة/خدمة:
 * حذف حركة ملف الموظف + إلغاء الفاتورة وعكس القيود (بدون حذف فعلي).
 */
export async function voidResidencyServiceInvoiceCore(
  deps: {
    prisma: TenantPrismaService;
    financialCore: FinancialCoreService;
    audit: AuditLogService;
  },
  residencyId: string,
  companyId: string,
  employeeId: string,
  invoiceId: string,
  userId: string | undefined,
  reason: string,
): Promise<void> {
  const { prisma, financialCore, audit } = deps;

  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
  });
  if (!inv) {
    throw new BadRequestException('فاتورة الخدمة غير موجودة — يتطلب مراجعة يدوية.');
  }
  if (inv.status === 'cancelled') {
    await prisma.employeeResidency.update({
      where: { id: residencyId },
      data: { invoiceId: null, residencyInvoiceAmount: null },
    });
    return;
  }

  const invoiceNum = inv.invoiceNumber;

  if (invoiceNum) {
    await prisma.employeeMovement.deleteMany({
      where: {
        companyId,
        employeeId,
        movementType: 'other',
        notes: { contains: invoiceNum },
      },
    });
  }

  await financialCore.cancelOperation(
    {
      companyId,
      referenceType: 'invoice',
      referenceId: invoiceId,
      reason,
    },
    userId,
  );

  await prisma.employeeResidency.update({
    where: { id: residencyId },
    data: { invoiceId: null, residencyInvoiceAmount: null },
  });

  await audit.log({
    companyId,
    userId,
    action: 'update',
    entity: 'employee_residency',
    entityId: residencyId,
    oldValue: { voidedInvoice: true, invoiceId },
    newValue: { reason },
  });
}
