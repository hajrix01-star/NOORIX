import { BadRequestException, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import type { Response } from 'express';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { INVOICE_ATTACHMENT_MIMES } from './invoice-attachment.constants';
import { toPublicInvoiceView } from './invoice-to-public.util';

export async function saveInvoiceAttachment(
  prisma: TenantPrismaService,
  audit: AuditLogService,
  invoiceId: string,
  companyId: string,
  file: Express.Multer.File | undefined,
  userId: string | null | undefined,
): Promise<ReturnType<typeof toPublicInvoiceView>> {
  if (!file?.path) {
    throw new BadRequestException('لم يتم رفع أي ملف.');
  }
  const mime = file.mimetype || '';
  if (!INVOICE_ATTACHMENT_MIMES.has(mime)) {
    await unlink(file.path).catch(() => {});
    throw new BadRequestException('نوع الملف غير مسموح. استخدم صورة (JPG أو PNG…) أو PDF.');
  }

  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
  });
  if (!existing) {
    await unlink(file.path).catch(() => {});
    throw new NotFoundException('الفاتورة غير موجودة.');
  }

  const originalName = (file.originalname || 'attachment').trim().slice(0, 240);
  const prevPath = existing.attachmentPath?.trim();

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      attachmentPath: file.path,
      attachmentOriginalName: originalName || null,
    },
  });

  if (prevPath && prevPath !== file.path && existsSync(prevPath)) {
    await unlink(prevPath).catch(() => {});
  }

  await audit.log({
    companyId,
    userId,
    action: 'update',
    entity: 'invoice',
    entityId: invoiceId,
    oldValue: { attachmentOriginalName: existing.attachmentOriginalName },
    newValue: { attachmentOriginalName: updated.attachmentOriginalName },
  });

  return toPublicInvoiceView(updated);
}

export async function removeInvoiceAttachment(
  prisma: TenantPrismaService,
  audit: AuditLogService,
  invoiceId: string,
  companyId: string,
  userId: string | null | undefined,
): Promise<ReturnType<typeof toPublicInvoiceView>> {
  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
  });
  if (!existing) {
    throw new NotFoundException('الفاتورة غير موجودة.');
  }
  const prevPath = existing.attachmentPath?.trim();
  const prevName = existing.attachmentOriginalName;

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      attachmentPath: null,
      attachmentOriginalName: null,
    },
  });

  if (prevPath && existsSync(prevPath)) {
    await unlink(prevPath).catch(() => {});
  }

  await audit.log({
    companyId,
    userId,
    action: 'update',
    entity: 'invoice',
    entityId: invoiceId,
    oldValue: { attachmentOriginalName: prevName },
    newValue: { attachmentOriginalName: null },
  });

  return toPublicInvoiceView(updated);
}

export async function downloadInvoiceAttachment(
  prisma: TenantPrismaService,
  invoiceId: string,
  companyId: string,
  res: Response,
): Promise<void> {
  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: { attachmentPath: true, attachmentOriginalName: true },
  });
  if (!inv) {
    throw new NotFoundException('لا يوجد مرفق لهذه الفاتورة.');
  }
  const p = inv.attachmentPath?.trim();
  if (!p) {
    throw new NotFoundException('لا يوجد مرفق لهذه الفاتورة.');
  }
  if (!existsSync(p)) {
    throw new NotFoundException('الملف غير موجود على الخادم.');
  }
  const name = inv.attachmentOriginalName?.trim() || 'attachment';
  res.download(p, name);
}
