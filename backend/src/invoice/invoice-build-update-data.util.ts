import { Prisma } from '@prisma/client';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';

/** حقول التحديث المباشرة من DTO — بدون منطق إلغاء أو قيود. */
export function buildInvoiceUncheckedUpdateFromDto(dto: UpdateInvoiceDto): Prisma.InvoiceUncheckedUpdateInput {
  const updateData: Prisma.InvoiceUncheckedUpdateInput = {};
  if (dto.supplierId !== undefined) updateData.supplierId = dto.supplierId;
  if (dto.supplierInvoiceNumber !== undefined) updateData.supplierInvoiceNumber = dto.supplierInvoiceNumber;
  if (dto.kind !== undefined) updateData.kind = dto.kind;
  if (dto.totalAmount !== undefined) updateData.totalAmount = new Prisma.Decimal(dto.totalAmount);
  if (dto.netAmount !== undefined) updateData.netAmount = new Prisma.Decimal(dto.netAmount);
  if (dto.taxAmount !== undefined) updateData.taxAmount = new Prisma.Decimal(dto.taxAmount);
  if (dto.transactionDate !== undefined) updateData.transactionDate = new Date(dto.transactionDate);
  if (dto.settledAt !== undefined) updateData.settledAt = dto.settledAt ? new Date(dto.settledAt) : null;
  if (dto.settledAmount !== undefined) updateData.settledAmount = new Prisma.Decimal(dto.settledAmount);
  if (dto.vaultSplits !== undefined && dto.vaultSplits.length > 0) {
    updateData.vaultId = dto.vaultSplits.length === 1 ? dto.vaultSplits[0].vaultId : null;
  } else if (dto.vaultId !== undefined) {
    updateData.vaultId = dto.vaultId;
  }
  if (dto.paymentMethodId !== undefined) updateData.paymentMethodId = dto.paymentMethodId;
  if (dto.status !== undefined) updateData.status = dto.status;
  if (dto.notes !== undefined) updateData.notes = dto.notes;
  if (dto.installmentCount !== undefined) updateData.installmentCount = dto.installmentCount;
  if (dto.installmentAmount !== undefined) updateData.installmentAmount = new Prisma.Decimal(dto.installmentAmount);
  if (dto.warrantyFollowUpDone !== undefined) updateData.warrantyFollowUpDone = dto.warrantyFollowUpDone;
  return updateData;
}
