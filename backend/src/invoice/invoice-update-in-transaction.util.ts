import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { AuditLogService } from '../audit/audit-log.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { nowSaudi } from '../common/utils/date-utils';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { buildInvoiceUncheckedUpdateFromDto } from './invoice-build-update-data.util';
import {
  assertNoActiveDuplicateSupplierInvoiceDedupKey,
  patchSupplierInvoiceDedupKeyOnUpdateInput,
} from './invoice-supplier-invoice-dedup.util';

/**
 * تحديث فاتورة داخل $transaction (قيود + audit).
 */
export async function updateInvoiceInTransaction(
  prisma: TenantPrismaService,
  financialCore: FinancialCoreService,
  id: string,
  dto: UpdateInvoiceDto,
  companyId: string,
  userId: string | null | undefined,
): Promise<Prisma.InvoiceGetPayload<object>> {
  const tenantId = TenantContext.getTenantId();

  return prisma.$transaction(async (tx) => {
    const oldInvoice = await tx.invoice.findFirstOrThrow({ where: { id, companyId } });

    const updateData = buildInvoiceUncheckedUpdateFromDto(dto);
    patchSupplierInvoiceDedupKeyOnUpdateInput(updateData, oldInvoice, dto);
    const mergedSupplierId =
      dto.supplierId !== undefined ? dto.supplierId : oldInvoice.supplierId;
    await assertNoActiveDuplicateSupplierInvoiceDedupKey(tx, {
      companyId,
      supplierId: mergedSupplierId,
      dedupKey: (updateData.supplierInvoiceDedupKey as string | null | undefined) ?? null,
      excludeInvoiceId: id,
    });

    const newInvoice = await tx.invoice.update({ where: { id }, data: updateData });

    if (dto.transactionDate !== undefined) {
      const newDate = new Date(dto.transactionDate);
      const period = await tx.fiscalPeriod.findFirst({
        where: {
          companyId,
          startDate: { lte: newDate },
          endDate: { gte: newDate },
        },
        select: { status: true, nameAr: true },
        orderBy: { startDate: 'desc' },
      });
      if (period?.status === 'closed') {
        throw new BadRequestException(
          `لا يمكن نقل الفاتورة إلى فترة مالية مغلقة: ${period.nameAr}`,
        );
      }

      await financialCore.syncActiveLedgerTransactionDateForOutflowInvoice(
        tx,
        companyId,
        id,
        newDate,
      );
    }

    const vaultRebuildPayload =
      dto.vaultSplits !== undefined && dto.vaultSplits.length > 0
        ? {
            vaultSplits: dto.vaultSplits.map((s) => ({
              vaultId: s.vaultId,
              amount: Number(s.amount),
            })),
          }
        : dto.vaultId !== undefined
          ? { vaultId: dto.vaultId }
          : null;

    const kindChanged = dto.kind !== undefined && dto.kind !== oldInvoice.kind;

    const monetaryChanged =
      !oldInvoice.totalAmount.equals(newInvoice.totalAmount) ||
      !oldInvoice.netAmount.equals(newInvoice.netAmount) ||
      !oldInvoice.taxAmount.equals(newInvoice.taxAmount);

    const ledgerSyncOpts = { preserveDebitAccount: !kindChanged } as const;

    if (vaultRebuildPayload) {
      await financialCore.rebuildOutflowInvoiceLedgerAfterVaultChange(
        tx,
        companyId,
        id,
        vaultRebuildPayload,
        userId ?? undefined,
        ledgerSyncOpts,
      );
    } else if (monetaryChanged || kindChanged) {
      await financialCore.rebuildOutflowInvoiceLedgerToMatchInvoice(
        tx,
        companyId,
        id,
        userId ?? undefined,
        ledgerSyncOpts,
      );
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        companyId,
        userId: userId ?? undefined,
        action: 'update',
        entity: 'invoice',
        entityId: id,
        oldValue: AuditLogService.invoiceToSnapshot(
          oldInvoice as Parameters<typeof AuditLogService.invoiceToSnapshot>[0],
        ) as object,
        newValue: AuditLogService.invoiceToSnapshot(
          newInvoice as Parameters<typeof AuditLogService.invoiceToSnapshot>[0],
        ) as object,
        createdAt: nowSaudi(),
      },
    });

    return newInvoice;
  });
}
