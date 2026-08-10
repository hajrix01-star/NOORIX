/**
 * إنشاء فاتورة صرف + قيود + تخصيصات + AuditLog — مسار مشترك بين processOutflow و processOutflowBatch
 */
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

  const supplierInvoiceDedupKey = computeSupplierInvoiceDedupKeyForOutflowDto(dto);
  await assertNoActiveDuplicateSupplierInvoiceDedupKey(tx, {
    companyId: dto.companyId,
    supplierId: dto.supplierId,
    dedupKey: supplierInvoiceDedupKey,
  });

  const splits = await support.resolveOutflowVaultSplits(tx, dto.companyId, dto);
  const debitAccountId =
    dto.debitAccountId ?? (await support.getDefaultExpenseAccount(tx, dto.companyId, dto.kind));
  const invoiceVaultId = splits.length === 1 ? splits[0].vaultId : null;

  const referenceType =
    dto.kind === 'salary' ? 'salary' : dto.kind === 'advance' ? 'advance' : 'invoice';
  const reportingClass = reportingClassOverride ?? reportingClassForOutflowKind(dto.kind);

  const invoice = await tx.invoice.create({
    data: {
      tenantId,
      companyId:       dto.companyId,
      supplierId:      dto.supplierId ?? null,
      employeeId:      dto.employeeId ?? null,
      expenseLineId:   dto.expenseLineId ?? null,
      categoryId:      dto.categoryId ?? null,
      invoiceNumber:         invoiceNumber,
      supplierInvoiceNumber: dto.supplierInvoiceNumber ?? null,
      supplierInvoiceDedupKey,
      kind:                  dto.kind,
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
