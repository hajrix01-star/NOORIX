/**
 * تقديم الكاشير، الاستخراج عبر طابور Bull (Redis)، طابور المراجعة، ومسار صورة الفاتورة.
 */
import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitOcrInvoiceDto } from './dto/submit-ocr.dto';
import type { SubmitOcrBatchDto } from './dto/submit-ocr-batch.dto';
import { OcrInvoiceStatus, OCR_REVIEW_QUEUE_STATUSES } from './ocr-invoice-status';
import { OcrExtractionService } from './ocr-extraction.service';
import { OcrInvoiceWorkflowPersistService } from './ocr-invoice-workflow-persist.service';
import { OcrUploadsLocalStorage } from './ocr-uploads-local.storage';
import { OCR_EXTRACTION_QUEUE } from './ocr-queue.constants';
import { buildAutoSaveDtoFromEnriched, shouldAutoFinalizeOcrSubmission } from './ocr-auto-finalize.util';
import { listOcrChatReminders } from './ocr-chat-reminders.util';
import { mergeOcrImageBuffersVertically } from './ocr-image-merge.util';
import type { OcrSaveInvoiceCaller } from './ocr-invoices.types';
import {
  OCR_EXTRACTION_JOB_OPTIONS,
  ocrExtractingStuckAfterMinutes,
  ocrQueueStuckAfterSeconds,
  ocrUseInlineExtraction,
} from './ocr-extraction-queue.util';

@Injectable()
export class OcrIntakeService {
  private readonly logger = new Logger(OcrIntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly extraction: OcrExtractionService,
    private readonly persist: OcrInvoiceWorkflowPersistService,
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

  private decodeSubmissionImage(imageBase64: string, mimeType?: string): { buf: Buffer; mime: string } {
    let buf: Buffer;
    try {
      buf = Buffer.from(imageBase64, 'base64');
    } catch {
      throw new BadRequestException('صورة غير صالحة (تشفير base64).');
    }
    const mime = (mimeType || 'image/jpeg').toLowerCase();
    this.validateSubmissionImageBuffer(buf, mime);
    return { buf, mime };
  }

  private mimeToExt(mime: string): string {
    if (mime.includes('png')) return 'png';
    if (mime.includes('webp')) return 'webp';
    return 'jpg';
  }

  private async createQueuedInvoiceFromBuffer(
    tenantId: string,
    companyId: string,
    submittedByUserId: string,
    buf: Buffer,
    mime: string,
  ) {
    const ext = this.mimeToExt(mime);
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

  /** كاشير: رفع صورة — يُنشئ سجلاً ثم يشغّل الاستخراج في الخلفية */
  async submitForExtraction(
    tenantId: string,
    companyId: string,
    submittedByUserId: string,
    dto: SubmitOcrInvoiceDto,
  ) {
    const { buf, mime } = this.decodeSubmissionImage(dto.imageBase64, dto.mimeType);
    return this.createQueuedInvoiceFromBuffer(tenantId, companyId, submittedByUserId, buf, mime);
  }

  async submitBatchForExtraction(
    tenantId: string,
    companyId: string,
    submittedByUserId: string,
    dto: SubmitOcrBatchDto,
  ) {
    const items: Array<{ id: string; status: string; layout: string; imageCount: number }> = [];
    for (const entry of dto.entries) {
      if (entry.layout === 'multi_page') {
        const decoded = entry.images.map((img) => this.decodeSubmissionImage(img.imageBase64, img.mimeType));
        const merged = await mergeOcrImageBuffersVertically(decoded.map((x) => x.buf));
        const created = await this.createQueuedInvoiceFromBuffer(
          tenantId,
          companyId,
          submittedByUserId,
          merged,
          'image/jpeg',
        );
        items.push({
          ...created,
          layout: entry.layout,
          imageCount: entry.images.length,
        });
        continue;
      }
      for (const image of entry.images) {
        const { buf, mime } = this.decodeSubmissionImage(image.imageBase64, image.mimeType);
        const created = await this.createQueuedInvoiceFromBuffer(
          tenantId,
          companyId,
          submittedByUserId,
          buf,
          mime,
        );
        items.push({
          ...created,
          layout: entry.layout,
          imageCount: 1,
        });
      }
    }
    return { items, count: items.length };
  }

  async getChatReminders(tenantId: string, companyId: string) {
    const reminders = await listOcrChatReminders(this.prisma, tenantId, companyId);
    return { reminders };
  }

  async retryExtractionForInvoice(tenantId: string, companyId: string, invoiceId: string) {
    const inv = await this.prisma.ocrInvoice.findFirst({
      where: { id: invoiceId, tenantId, companyId },
      select: { id: true, status: true, imageUrl: true },
    });
    if (!inv) throw new NotFoundException('الفاتورة غير موجودة.');
    if (!inv.imageUrl) {
      throw new BadRequestException('لا يمكن إعادة المحاولة بدون صورة فاتورة.');
    }
    if (inv.status === OcrInvoiceStatus.EXTRACTING) {
      throw new BadRequestException('الاستخراج قيد التنفيذ حالياً.');
    }
    if (
      inv.status !== OcrInvoiceStatus.EXTRACTION_FAILED &&
      inv.status !== OcrInvoiceStatus.QUEUED &&
      inv.status !== OcrInvoiceStatus.PENDING_REVIEW
    ) {
      throw new BadRequestException('إعادة المحاولة متاحة للحالات: انتظار، فشل، أو بانتظار المراجعة.');
    }

    await this.prisma.ocrInvoice.update({
      where: { id: inv.id },
      data: { status: OcrInvoiceStatus.QUEUED, extractionError: null },
    });
    this.scheduleExtractionAfterSubmit(inv.id);
    return { id: inv.id, status: OcrInvoiceStatus.QUEUED };
  }

  private scheduleExtractionAfterSubmit(invoiceId: string): void {
    void this.dispatchExtraction(invoiceId);
  }

  /** Bull queue with inline fallback when Redis/Bull unavailable */
  async dispatchExtraction(invoiceId: string): Promise<void> {
    if (ocrUseInlineExtraction()) {
      this.runExtractionSafe(invoiceId);
      return;
    }
    try {
      await this.extractionQueue.add(
        'run-extraction',
        { invoiceId },
        OCR_EXTRACTION_JOB_OPTIONS,
      );
    } catch (err) {
      this.logger.warn(
        `Bull enqueue failed for ${invoiceId}: ${(err as Error).message}. Running inline.`,
      );
      this.runExtractionSafe(invoiceId);
    }
  }

  private runExtractionSafe(invoiceId: string): void {
    void this.runExtractionForInvoice(invoiceId).catch((err) => {
      this.logger.error(`OCR extraction crashed for ${invoiceId}: ${(err as Error).message}`);
    });
  }

  /** Sweeper: queued invoices older than threshold — run extraction directly */
  async processStuckQueuedInvoices(limit = 8, minAgeSeconds?: number): Promise<number> {
    const maxAgeSeconds = minAgeSeconds ?? ocrQueueStuckAfterSeconds();
    const cutoff = new Date(Date.now() - maxAgeSeconds * 1000);
    const stuck = await this.prisma.ocrInvoice.findMany({
      where: {
        status: OcrInvoiceStatus.QUEUED,
        updatedAt: { lte: cutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    for (const row of stuck) {
      this.logger.warn(`Processing stuck queued OCR invoice ${row.id}`);
      await this.runExtractionForInvoice(row.id);
    }
    return stuck.length;
  }

  /** Sweeper: reset long-running extracting jobs back to queue */
  async recoverStuckExtractingInvoices(limit = 5): Promise<number> {
    const maxAgeMinutes = ocrExtractingStuckAfterMinutes();
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const stuck = await this.prisma.ocrInvoice.findMany({
      where: {
        status: OcrInvoiceStatus.EXTRACTING,
        updatedAt: { lte: cutoff },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    for (const row of stuck) {
      await this.prisma.ocrInvoice.update({
        where: { id: row.id },
        data: {
          status: OcrInvoiceStatus.QUEUED,
          extractionError: 'extracting_timeout_requeued',
        },
      });
      void this.dispatchExtraction(row.id);
    }
    return stuck.length;
  }

  /** يُستدعى من عامل Bull (تسلسل concurrency:1 على مستوى الطابور). */
  async runExtractionForInvoice(invoiceId: string): Promise<void> {
    const inv = await this.prisma.ocrInvoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, tenantId: true, companyId: true, imageUrl: true, status: true },
    });
    if (!inv?.imageUrl) return;

    const claimed = await this.prisma.ocrInvoice.updateMany({
      where: {
        id: inv.id,
        status: OcrInvoiceStatus.QUEUED,
      },
      data: {
        status: OcrInvoiceStatus.EXTRACTING,
        extractionError: null,
      },
    });
    if (claimed.count === 0) return;

    const relPath = inv.imageUrl.replace(/\\/g, '/');
    if (!this.uploads.exists(relPath)) {
      await this.markExtractionFailed(inv.id, 'ملف الصورة غير موجود على الخادم.');
      return;
    }

    let buf: Buffer;
    try {
      buf = await this.uploads.readBuffer(relPath);
    } catch (e) {
      await this.markExtractionFailed(inv.id, `تعذّر قراءة الملف: ${(e as Error).message}`);
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
      await this.markExtractionFailed(
        inv.id,
        (e as Error).message?.slice(0, 2000) || 'فشل الاستخراج',
      );
      return;
    }

    if (enriched.parseError === true) {
      await this.markExtractionFailed(
        inv.id,
        String(enriched.errorDetail || 'parse_error').slice(0, 2000),
        enriched,
      );
      return;
    }

    await this.applyEnrichedResultToInvoiceRecord(inv.tenantId, inv.companyId, inv.id, enriched);
    await this.tryAutoFinalizeInvoice(inv.tenantId, inv.companyId, inv.id, enriched);
  }

  private async markExtractionFailed(
    invoiceId: string,
    extractionError: string,
    rawExtraction?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.ocrInvoice.update({
      where: { id: invoiceId },
      data: {
        status: OcrInvoiceStatus.EXTRACTION_FAILED,
        extractionError: extractionError.slice(0, 2000),
        ...(rawExtraction ? { rawExtraction: rawExtraction as object } : {}),
      },
    });
  }

  private async resolveAutoSaveCaller(submittedByUserId?: string | null): Promise<OcrSaveInvoiceCaller | undefined> {
    if (!submittedByUserId) return undefined;
    const user = await this.prisma.user.findUnique({
      where: { id: submittedByUserId },
      include: { role: true },
    });
    if (!user) return undefined;
    return {
      userId: user.id,
      role: user.role?.name,
      permissions: user.role?.permissions || [],
    };
  }

  private async tryAutoFinalizeInvoice(
    tenantId: string,
    companyId: string,
    invoiceId: string,
    enriched: Record<string, unknown>,
  ): Promise<void> {
    const dto = buildAutoSaveDtoFromEnriched(invoiceId, enriched);
    if (!dto) {
      this.logger.warn(`OCR auto-save skipped (${invoiceId}): insufficient extracted data`);
      return;
    }
    const inv = await this.prisma.ocrInvoice.findUnique({
      where: { id: invoiceId },
      select: { submittedByUserId: true },
    });
    const caller = await this.resolveAutoSaveCaller(inv?.submittedByUserId);
    if (!shouldAutoFinalizeOcrSubmission(inv?.submittedByUserId, caller)) {
      this.logger.log(`OCR auto-save skipped (${invoiceId}): submitter requires manual review`);
      return;
    }
    try {
      await this.persist.saveInvoice(tenantId, companyId, dto, caller);
      this.logger.log(`OCR auto-saved invoice ${invoiceId}`);
    } catch (err) {
      this.logger.warn(`OCR auto-save failed for ${invoiceId}: ${(err as Error).message}`);
    }
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
      const autoMatchedItemId = im?.status === 'auto' ? (im.id || null) : null;
      return {
        rawName: String(item.name || ''),
        nameAr: (item.nameAr as string) || null,
        nameEn: (item.nameEn as string) || null,
        size: (item.size as string) || null,
        sizeUnit: (item.sizeUnit as string) || null,
        itemId: autoMatchedItemId,
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
        submittedBy: { select: { id: true, nameAr: true, nameEn: true, email: true } },
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
