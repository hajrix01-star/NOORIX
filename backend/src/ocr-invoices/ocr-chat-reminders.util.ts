import type { PrismaService } from '../prisma/prisma.service';
import { OcrInvoiceStatus } from './ocr-invoice-status';

export type OcrChatReminderRow = {
  id: string;
  invoiceId: string;
  error: string;
  submittedByName: string | null;
  submittedByUserId: string | null;
  createdAt: string;
};

export async function listOcrChatReminders(
  prisma: PrismaService,
  tenantId: string,
  companyId: string,
  limit = 20,
): Promise<OcrChatReminderRow[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.ocrInvoice.findMany({
    where: {
      tenantId,
      companyId,
      status: OcrInvoiceStatus.EXTRACTION_FAILED,
      updatedAt: { gte: since },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      extractionError: true,
      submittedByUserId: true,
      createdAt: true,
      submittedBy: { select: { nameAr: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    invoiceId: row.id,
    error: String(row.extractionError || 'فشل الاستخراج').slice(0, 500),
    submittedByName: row.submittedBy?.nameAr || row.submittedBy?.email || null,
    submittedByUserId: row.submittedByUserId,
    createdAt: row.createdAt.toISOString(),
  }));
}
