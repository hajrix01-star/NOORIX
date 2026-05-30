import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { TenantContext } from '../common/tenant-context';
import { assertVaultsUsableForPayment } from '../vaults/assert-vaults-for-payment.util';
import { saudiDateYmd } from './utils/hr-saudi-dates.util';
import { buildHrServiceInvoiceNotes } from './constants/employee-hr-service-categories';
import { employeeDisplayNameForNotes } from './utils/employee-display-name.util';

type ResidencyForInvoice = {
  id: string;
  companyId: string;
  employeeId: string;
  serviceCategory: string;
  iqamaNumber: string | null;
  referenceLabel: string | null;
  invoiceId: string | null;
  transactionDate?: Date | null;
  employee?: { name?: string | null; nameEn?: string | null } | null;
};

export async function issueResidencyServiceInvoiceCore(
  deps: { prisma: TenantPrismaService; financialCore: FinancialCoreService },
  residency: ResidencyForInvoice,
  userId: string,
  options: { amount: number; vaultId: string; transactionDate?: string },
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  if (residency.invoiceId) {
    throw new BadRequestException('يوجد فاتورة مرتبطة بهذا السجل مسبقاً.');
  }
  const amount = Number(options.amount);
  if (!Number.isFinite(amount) || amount < 0.01) {
    throw new BadRequestException('المبلغ غير صالح.');
  }
  const amountStr = (Math.round(amount * 100) / 100).toFixed(2);

  await assertVaultsUsableForPayment(deps.prisma, residency.companyId, [options.vaultId]);

  const emp = residency.employee
    ?? (await deps.prisma.employee.findFirst({
      where: { id: residency.employeeId, companyId: residency.companyId },
      select: { name: true, nameEn: true },
    }));
  if (!emp) throw new BadRequestException('الموظف غير موجود.');

  const txDate = options.transactionDate?.slice(0, 10) || saudiDateYmd();
  const empName = employeeDisplayNameForNotes(emp);
  const notes = buildHrServiceInvoiceNotes(residency.serviceCategory, empName, {
    iqamaNumber: residency.iqamaNumber,
    referenceLabel: residency.referenceLabel,
  });

  const { invoice } = await deps.financialCore.processOutflow(
    {
      companyId: residency.companyId,
      employeeId: residency.employeeId,
      kind: 'hr_expense',
      totalAmount: amountStr,
      netAmount: amountStr,
      taxAmount: '0',
      transactionDate: txDate,
      vaultSplits: [{ vaultId: options.vaultId, amount: amountStr }],
      notes,
      idempotencyKey: `hr-service:${residency.id}`,
    },
    userId,
  );

  await deps.prisma.employeeResidency.update({
    where: { id: residency.id },
    data: {
      invoiceId: invoice.id,
      residencyInvoiceAmount: new Prisma.Decimal(amountStr),
      transactionDate: residency.transactionDate ?? new Date(`${txDate}T00:00:00.000Z`),
    },
  });

  const tenantId = TenantContext.getTenantId();
  await deps.prisma.employeeMovement.create({
    data: {
      tenantId,
      companyId: residency.companyId,
      employeeId: residency.employeeId,
      movementType: 'other',
      amount: new Prisma.Decimal(amountStr),
      previousValue: null,
      newValue: amountStr,
      effectiveDate: new Date(`${txDate}T00:00:00.000Z`),
      notes: `${notes} — ${invoice.invoiceNumber}`,
    },
  });

  return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
}
