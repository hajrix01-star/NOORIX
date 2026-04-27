/**
 * تقديم الكاشير، الاستخراج عبر طابور Bull (Redis)، طابور المراجعة، ومسار صورة الفاتورة.
 */
import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitOcrInvoiceDto } from './dto/submit-ocr.dto';
import { OcrInvoiceStatus, OCR_REVIEW_QUEUE_STATUSES } from './ocr-invoice-status';
import { OcrExtractionService } from './ocr-extraction.service';
import { OcrUploadsLocalStorage } from './ocr-uploads-local.storage';
import { OCR_EXTRACTION_QUEUE } from './ocr-queue.constants';

@Injectable()
export class OcrIntakeService {
  private readonly logger = new Logger(OcrIntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly extraction: OcrExtractionService,
    private readonly uploads: OcrUploadsLocalStorage,
    @InjectQueue(OCR_EXTRACTION_QUEUE) private readonly extractionQueue: Queue,
  ) {}

  // ─── Cashier submission + background extraction ───────────────────────────

  private validateSubmissionImageBuffer(buf: Buffer, mimeType: string): void {
    const max = 12 * 1024 * 1024;
    if (!buf?.length || buf.length > max) {
      throw new BadRequestException('حجم الصورة غير مقبول (الحد الأقصى 12 ميجابايت).');
    }
    const m = (mimeType || '').toLowerCase();
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(m)) {
      throw new BadRequestException('نوع الملف غير مدعوم. استخدم JPG أو PNG أو WEBP.');
    }
    const b0 = buf[0];
    const b1 = buf[1];
    const isJpeg = b0 === 0xff && b1 === 0xd8;
    const isPng = b0 === 0x89 && buf[1] === 0x50;
    const isWebp = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
    if (!isJpeg && !isPng && !isWebp) {
      throw new BadRequestException('الملف ليس صورة صالحة أو تالف.');
    }
    if (buf.length < 800) {
      throw new BadRequestException('الصورة صغيرة جداً وقد لا تكون قابلة للقراءة.');
    }
  }

  private relativeOcrImagePath(companyId: string, invoiceId: string, ext: string): string {
    return `ocr-invoices/${companyId}/${invoiceId}.${ext}`;
  }

  /** كاشير: رفع صورة — يُنشئ سجلاً ثم يشغّل الاستخراج في الخلفية */
  async submitForExtraction(
    tenantId: string,
    companyId: string,
    submittedByUserId: string,
    dto: SubmitOcrInvoiceDto,
  ) {
    const mime = (dto.mimeType || 'image/jpeg').toLowerCase();
    let buf: Buffer;
    try {
      buf = Buffer.from(dto.imageBase64, 'base64');
    } catch {
      throw new BadRequestException('صورة غير صالحة (تشفير base64).');
    }
    this.validateSubmissionImageBuffer(buf, mime);

    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';

    const inv = await this.prisma.ocrInvoice.create({
      data: {
        tenantId,
        companyId,
        status: OcrInvoiceStatus.QUEUED,
        submittedByUserId,
        extractionError: null,
      },
    });

    const rel = this.relativeOcrImagePath(companyId, inv.id, ext);
    await this.uploads.writeBuffer(rel, buf);

    await this.prisma.ocrInvoice.update({
      where: { id: inv.id },
      data: { imageUrl: rel },
    });

    this.scheduleExtractionAfterSubmit(inv.id);

    return { id: inv.id, status: OcrInvoiceStatus.QUEUED };
  }

  private scheduleExtractionAfterSubmit(invoiceId: string): void {
    void this.extractionQueue
      .add(
        'run-extraction',
        { invoiceId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 200,
          removeOnFail: 100,
        },
      )
      .catch((err) => {
        this.logger.error(`Failed to enqueue OCR extraction for ${invoiceId}: ${(err as Error).message}`);
      });
  }

  /** يُستدعى من عامل Bull (تسلسل concurrency:1 على مستوى الطابور). */
  async runExtractionForInvoice(invoiceId: string): Promise<void> {
    const inv = await this.prisma.ocrInvoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, tenantId: true, companyId: true, imageUrl: true, status: true },
    });
    if (!inv?.imageUrl) return;

    await this.prisma.ocrInvoice.update({
      where: { id: inv.id },
      data: { status: OcrInvoiceStatus.EXTRACTING, extractionError: null },
    });

    const relPath = inv.imageUrl.replace(/\\/g, '/');
    if (!this.uploads.exists(relPath)) {
      await this.prisma.ocrInvoice.update({
        where: { id: inv.id },
        data: {
          status: OcrInvoiceStatus.EXTRACTION_FAILED,
          extractionError: 'ملف الصورة غير موجود على الخادم.',
        },
      });
      return;
    }

    let buf: Buffer;
    try {
      buf = await this.uploads.readBuffer(relPath);
    } catch (e) {
      await this.prisma.ocrInvoice.update({
        where: { id: inv.id },
        data: {
          status: OcrInvoiceStatus.EXTRACTION_FAILED,
          extractionError: `تعذّر قراءة الملف: ${(e as Error).message}`,
        },
      });
      return;
    }

    const mime = inv.imageUrl.endsWith('.png')
      ? 'image/png'
      : inv.imageUrl.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';

    let enriched: Record<string, unknown>;
    try {
      enriched = (await this.extraction.extractInvoice(inv.tenantId, inv.companyId, {
        imageBase64: buf.toString('base64'),
        mimeType: mime,
      })) as Record<string, unknown>;
    } catch (e) {
      await this.prisma.ocrInvoice.update({
        where: { id: inv.id },
        data: {
          status: OcrInvoiceStatus.EXTRACTION_FAILED,
          extractionError: (e as Error).message?.slice(0, 2000) || 'فشل الاستخراج',
        },
      });
      return;
    }

    if (enriched.parseError === true) {
      await this.prisma.ocrInvoice.update({
        where: { id: inv.id },
        data: {
          status: OcrInvoiceStatus.EXTRACTION_FAILED,
          extractionError: String(enriched.errorDetail || 'parse_error').slice(0, 2000),
          rawExtraction: enriched as object,
        },
      });
      return;
    }

    await this.applyEnrichedResultToInvoiceRecord(inv.tenantId, inv.companyId, inv.id, enriched);
  }

  /** يحوّل ناتج enrichExtraction إلى سجل فاتورة + سطور بحالة انتظار المراجعة */
  private async applyEnrichedResultToInvoiceRecord(
    tenantId: string,
    companyId: string,
    invoiceId: string,
    enriched: Record<string, unknown>,
  ): Promise<void> {
    const supplierMatch = enriched.supplierMatch as { id?: string } | null | undefined;
    const invNum = enriched.invoiceNumber as { value?: string } | undefined;
    const invDate = enriched.invoiceDate as { value?: string } | undefined;
    const subtotal = enriched.subtotalAmount as { value?: number } | undefined;
    const total = enriched.totalAmount as { value?: number } | undefined;
    const vat = enriched.vatAmount as { value?: number } | undefined;
    const items = (enriched.items || []) as Array<Record<string, unknown>>;

    const lineCreates = items.map((item) => {
      const im = item.itemMatch as { id?: string; status?: string } | null | undefined;
      return {
        rawName: String(item.name || ''),
        nameAr: (item.nameAr as string) || null,
        nameEn: (item.nameEn as string) || null,
        size: (item.size as string) || null,
        sizeUnit: (item.sizeUnit as string) || null,
        itemId: im?.id || null,
        quantity: item.quantity != null ? new Prisma.Decimal(Number(item.quantity)) : null,
        unitPrice: item.unitPrice != null ? new Prisma.Decimal(Number(item.unitPrice)) : null,
        totalPrice: item.totalPrice != null ? new Prisma.Decimal(Number(item.totalPrice)) : null,
        confidence: typeof item.confidence === 'number' ? item.confidence : 0,
        matchStatus: im?.status || 'pending',
      };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.ocrInvoiceLine.deleteMany({ where: { invoiceId } });
      await tx.ocrInvoice.update({
        where: { id: invoiceId },
        data: {
          supplierId: supplierMatch?.id || null,
          invoiceNumber: invNum?.value || null,
          invoiceDate: invDate?.value ? new Date(invDate.value) : null,
          subtotalAmount: subtotal?.value != null ? new Prisma.Decimal(subtotal.value) : null,
          totalAmount: total?.value != null ? new Prisma.Decimal(total.value) : null,
          vatAmount: vat?.value != null ? new Prisma.Decimal(vat.value) : null,
          rawExtraction: enriched as object,
          status: OcrInvoiceStatus.PENDING_REVIEW,
          extractionError: null,
          lines: { create: lineCreates },
        },
      });
    });
  }

  async getReviewQueueInvoices(tenantId: string, companyId: string) {
    return this.prisma.ocrInvoice.findMany({
      where: {
        tenantId,
        companyId,
        status: { in: [...OCR_REVIEW_QUEUE_STATUSES] },
      },
      include: {
        supplier: { select: { id: true, nameAr: true } },
        submittedBy: { select: { id: true, nameAr: true, email: true } },
        lines: { include: { item: { select: { id: true, nameAr: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assertInvoiceImagePath(tenantId: string, companyId: string, invoiceId: string): Promise<string> {
    const inv = await this.prisma.ocrInvoice.findFirst({
      where: { id: invoiceId, tenantId, companyId },
      select: { imageUrl: true },
    });
    if (!inv?.imageUrl) throw new NotFoundException('لا توجد صورة لهذه الفاتورة.');
    const rel = inv.imageUrl.replace(/\\/g, '/');
    if (rel.includes('..') || !rel.startsWith(`ocr-invoices/${companyId}/`)) {
      throw new BadRequestException('مسار الملف غير صالح.');
    }
    if (!this.uploads.exists(rel)) throw new NotFoundException('ملف الصورة غير موجود.');
    return this.uploads.resolveAbsolute(rel);
  }
}
