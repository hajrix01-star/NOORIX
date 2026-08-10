/**
 * إنشاء فاتورة صرف + قيود + تخصيصات + AuditLog — مسار مشترك بين processOutflow و processOutflowBatch
 */
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validateJournalBalance, type JsonObject } from './financial-core-helpers.util';
import { FinancialCoreSupportService } from './financial-core-support.service';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import type { OutflowDto } from './dto/financial-operation.dto';
import type { TxClient } from './financial-core-helpers.util';
import { reportingClassForOutflowKind, type LedgerReportingClass } from './financial-reporting-classification.util';
import {
  assertNoActiveDuplicateSupplierInvoiceDedupKey,
  computeSupplierInvoiceDedupKeyForOutflowDto,
} from '../invoice/invoice-supplier-invoice-dedup.util';

type OperationalCategoryPosting = {
  accountId: string | null;
  reportingClass: LedgerReportingClass;
  categoryId: string;
  supplierId?: string;
};

async function resolveOperationalCategoryPosting(
  tx: TxClient,
  dto: OutflowDto,
): Promise<OperationalCategoryPosting | null> {
  if (!['purchase', 'expense', 'fixed_expense', 'hr_expense'].includes(dto.kind)) {
    return null;
  }

  let categoryId = dto.categoryId;
  let supplierId = dto.supplierId;
  if (dto.expenseLineId) {
    const line = await tx.expenseLine.findFirst({
      where: { id: dto.expenseLineId, companyId: dto.companyId, isActive: true },
      select: { categoryId: true, supplierId: true, kind: true },
    });
    if (!line) {
      throw new BadRequestException('بند المصروف المختار غير موجود أو غير نشط لهذه الشركة.');
    }
    if (dto.kind !== line.kind) {
      throw new BadRequestException('نوع الفاتورة لا يطابق بند المصروف المختار.');
    }
    if (dto.categoryId && dto.categoryId !== line.categoryId) {
      throw new BadRequestException('الفئة لا تطابق بند المصروف المختار.');
    }
    if (dto.supplierId && dto.supplierId !== line.supplierId) {
      throw new BadRequestException('المورد لا يطابق بند المصروف المختار.');
    }
    categoryId = line.categoryId;
    supplierId = line.supplierId;
  }

  if (!categoryId) return null;
  const category = await tx.category.findFirst({
    where: { id: categoryId, companyId: dto.companyId, isActive: true },
    select: { accountId: true, reportingClass: true, type: true },
  });
  if (!category) {
    throw new BadRequestException('الفئة المختارة غير موجودة أو غير نشطة لهذه الشركة.');
  }
  if (dto.kind === 'purchase' && category.type !== 'purchase') {
    throw new BadRequestException('فئة الفاتورة لا تطابق نوع المشتريات.');
  }
  if (dto.kind !== 'purchase' && category.type !== 'expense') {
    throw new BadRequestException('فئة المصروف لا تطابق نوع فاتورة الصرف.');
  }
  return {
    accountId: category.accountId,
    reportingClass: category.reportingClass as LedgerReportingClass,
    categoryId,
    ...(supplierId ? { supplierId } : {}),
  };
}
export async function persistOutflowInvoiceWithLedger(
  tx: TxClient,
  support: FinancialCoreSupportService,
  fiscalPeriod: FiscalPeriodService,
  p: {
    tenantId: string;
    userId: string;
    dto: OutflowDto;
    entryDate: Date;
    txDate: Date;
    invoiceNumber: string;
    reportingClassOverride?: LedgerReportingClass;
  },
): Promise<{
  invoice: Awaited<ReturnType<typeof tx.invoice.create>>;
  ledgerEntries: Awaited<ReturnType<typeof tx.ledgerEntry.create>>[];
}> {
  const { tenantId, userId, dto, entryDate, txDate, invoiceNumber, reportingClassOverride } = p;
  await fiscalPeriod.assertPeriodOpenForDate(tx, dto.companyId, txDate);

  const categoryPosting = await resolveOperationalCategoryPosting(tx, dto);
  const effectiveDto: OutflowDto = {
    ...dto,
    ...(categoryPosting ? { categoryId: categoryPosting.categoryId } : {}),
    ...(categoryPosting?.supplierId ? { supplierId: categoryPosting.supplierId } : {}),
  };
  const supplierInvoiceDedupKey = computeSupplierInvoiceDedupKeyForOutflowDto(effectiveDto);
  await assertNoActiveDuplicateSupplierInvoiceDedupKey(tx, {
    companyId: effectiveDto.companyId,
    supplierId: effectiveDto.supplierId,
    dedupKey: supplierInvoiceDedupKey,
  });

  const splits = await support.resolveOutflowVaultSplits(tx, effectiveDto.companyId, effectiveDto);
  const debitAccountId =
    categoryPosting?.accountId ?? effectiveDto.debitAccountId ?? (await support.getDefaultExpenseAccount(tx, effectiveDto.companyId, effectiveDto.kind));
  const invoiceVaultId = splits.length === 1 ? splits[0].vaultId : null;

  const referenceType =
    effectiveDto.kind === 'salary' ? 'salary' : effectiveDto.kind === 'advance' ? 'advance' : 'invoice';
  const reportingClass =
    reportingClassOverride ?? categoryPosting?.reportingClass ?? reportingClassForOutflowKind(effectiveDto.kind);

  const invoice = await tx.invoice.create({
    data: {
      tenantId,
      companyId:       dto.companyId,
      supplierId:      effectiveDto.supplierId ?? null,
      employeeId:      dto.employeeId ?? null,
      expenseLineId:   dto.expenseLineId ?? null,
      categoryId:      effectiveDto.categoryId ?? null,
      invoiceNumber:         invoiceNumber,
      supplierInvoiceNumber: dto.supplierInvoiceNumber ?? null,
      supplierInvoiceDedupKey,
      kind:                  effectiveDto.kind,
      totalAmount:           new Prisma.Decimal(dto.totalAmount),
      netAmount:             new Prisma.Decimal(dto.netAmount),
      taxAmount:             new Prisma.Decimal(dto.taxAmount),
      transactionDate:       txDate,
      invoiceDate:           dto.invoiceDate ? new Date(dto.invoiceDate) : null,
      entryDate,
      vaultId:               invoiceVaultId,
      batchId:               dto.batchId ?? null,
      notes:                 dto.notes ?? null,
      installmentCount:      dto.installmentCount ?? null,
      installmentAmount:     dto.installmentAmount ? new Prisma.Decimal(dto.installmentAmount) : null,
      expenseCoverageYear:       dto.expenseCoverageYear ?? null,
      expenseCoverageQuarter:    dto.expenseCoverageQuarter ?? null,
      expenseCoverageMonthStart: dto.expenseCoverageMonthStart ?? null,
      expenseMonthsCovered:      dto.expenseMonthsCovered ?? null,
      warrantyFollowUp:          dto.warrantyFollowUp === true,
      warrantyFollowUpDone:      false,
      status:                'active',
      createdByUserId:       userId,
    },
  });

  const ledgerEntries: Awaited<ReturnType<typeof tx.ledgerEntry.create>>[] = [];
  validateJournalBalance(
    [{ amount: new Prisma.Decimal(String(dto.totalAmount)) }],
    splits.map((s) => ({ amount: s.amount })),
  );
  for (const split of splits) {
    const creditAccountId = await support.getVaultAccount(tx, dto.companyId, split.vaultId);
    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        tenantId,
        companyId:       dto.companyId,
        debitAccountId,
        creditAccountId,
        amount:          split.amount,
        transactionDate: txDate,
        entryDate,
        referenceType,
        referenceId:     invoice.id,
        reportingClass,
        vaultId:         split.vaultId,
        employeeId:      dto.employeeId ?? null,
        createdById:     userId,
        status:          'active',
      },
    });
    ledgerEntries.push(ledgerEntry);

    await tx.invoiceVaultAllocation.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        vaultId:   split.vaultId,
        amount:    split.amount,
      },
    });
  }

  await tx.auditLog.create({
    data: {
      tenantId,
      companyId: dto.companyId,
      userId,
      action:    'create',
      entity:    'invoice',
      entityId:  invoice.id,
      newValue:  support.invoiceSnapshot(invoice) as JsonObject,
      createdAt: entryDate,
    },
  });

  return { invoice, ledgerEntries };
}
