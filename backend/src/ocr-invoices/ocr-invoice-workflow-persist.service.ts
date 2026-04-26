/**
 * حفظ/اعتماد فواتير OCR وربط مشتريات عند الاعتماد
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveInvoiceDto } from './dto/save-invoice.dto';
import { CreateInvoiceDto } from '../invoice/dto/create-invoice.dto';
import { InvoiceService } from '../invoice/invoice.service';
import { hasPermission, PERMISSIONS } from '../auth/constants/permissions';
import { OcrInvoiceStatus } from './ocr-invoice-status';
import type { OcrSaveInvoiceCaller } from './ocr-invoices.types';
import {
  processOcrLinesAgainstCatalog,
  recordOcrPriceHistoryForProcessedLines,
} from './ocr-invoice-workflow-save-helpers.util';

@Injectable()
export class OcrInvoiceWorkflowPersistService {
  private readonly logger = new Logger(OcrInvoiceWorkflowPersistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async saveInvoice(
    tenantId: string,
    companyId: string,
    dto: SaveInvoiceDto,
    caller?: OcrSaveInvoiceCaller,
  ) {
    if (dto.purchase && !dto.id) {
      throw new BadRequestException('ربط فاتورة مشتريات متاح فقط عند اعتماد فاتورة من المراجعة (معرّف السجل).');
    }
    if (dto.id) {
      return this.finalizePendingReviewInvoice(tenantId, companyId, dto, caller);
    }

    const { lines, invoiceDate, totalAmount, vatAmount, supplierName, purchase: _purchase, ...invoiceData } = dto;
    void _purchase;

    let supplierId = invoiceData.supplierId || null;
    if (!supplierId && supplierName?.trim()) {
      const existing = await this.prisma.ocrSupplier.findFirst({
        where: { tenantId, companyId, nameAr: supplierName.trim() },
      });
      if (existing) {
        supplierId = existing.id;
      } else {
        const newSupplier = await this.prisma.ocrSupplier.create({
          data: { tenantId, companyId, nameAr: supplierName.trim() },
        });
        supplierId = newSupplier.id;
        this.logger.log(`Auto-created OCR supplier: ${supplierName} (${newSupplier.id})`);
      }
    }

    const allCatalogItems = await this.prisma.ocrItem.findMany({
      where: { tenantId, companyId },
      include: { aliases: true },
    });

    const workCatalog = [...allCatalogItems];
    const processedLines = await processOcrLinesAgainstCatalog(
      this.prisma,
      tenantId,
      companyId,
      lines,
      workCatalog,
      this.logger,
    );

    const invoice = await this.prisma.ocrInvoice.create({
      data: {
        tenantId,
        companyId,
        supplierId,
        invoiceNumber: invoiceData.invoiceNumber || null,
        imageUrl: invoiceData.imageUrl || null,
        rawExtraction: invoiceData.rawExtraction ? (invoiceData.rawExtraction as object) : undefined,
        notes: invoiceData.notes || null,
        subtotalAmount: (invoiceData as { subtotalAmount?: number }).subtotalAmount || null,
        totalAmount: totalAmount ? totalAmount : null,
        vatAmount: vatAmount ? vatAmount : null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        status: OcrInvoiceStatus.CONFIRMED,
        lines: {
          create: processedLines.map((l) => ({
            rawName: l.rawName,
            nameAr: (l as { nameAr?: string }).nameAr || null,
            nameEn: (l as { nameEn?: string }).nameEn || null,
            size: (l as { size?: string }).size || null,
            sizeUnit: (l as { sizeUnit?: string }).sizeUnit || null,
            itemId: l.itemId || null,
            quantity: l.quantity ? l.quantity : null,
            unitPrice: l.unitPrice ? l.unitPrice : null,
            totalPrice: l.totalPrice ? l.totalPrice : null,
            confidence: l.confidence ?? 0,
            matchStatus: l.matchStatus,
          })),
        },
      },
      include: { lines: true },
    });

    if (supplierId && invoiceDate) {
      const invEx = invoiceData as { subtotalAmount?: number };
      await recordOcrPriceHistoryForProcessedLines(
        this.prisma,
        tenantId,
        companyId,
        supplierId,
        invoiceDate,
        processedLines,
        invoice.id,
        {
          subtotalAmount: invEx.subtotalAmount != null ? Number(invEx.subtotalAmount) : null,
          totalAmount: totalAmount != null ? Number(totalAmount) : null,
          vatAmount: vatAmount != null ? Number(vatAmount) : null,
        },
      );
    }

    return invoice;
  }

  private async finalizePendingReviewInvoice(
    tenantId: string,
    companyId: string,
    dto: SaveInvoiceDto,
    caller?: OcrSaveInvoiceCaller,
  ) {
    const { id, lines, invoiceDate, totalAmount, vatAmount, supplierName, purchase, ...invoiceData } = dto;
    if (!id) throw new BadRequestException('معرف الفاتورة مطلوب للاعتماد.');

    const existing = await this.prisma.ocrInvoice.findFirst({
      where: { id, tenantId, companyId },
    });
    if (!existing) throw new NotFoundException('الفاتورة غير موجودة.');
    if (existing.status !== OcrInvoiceStatus.PENDING_REVIEW) {
      throw new BadRequestException('يمكن اعتماد الفواتير في حالة «بانتظار المراجعة» فقط.');
    }
    if (purchase && existing.linkedPurchaseInvoiceId) {
      throw new BadRequestException('هذه الفاتورة مرتبطة بفاتورة مشتريات محاسبية مسبقاً.');
    }
    if (purchase) {
      if (!caller?.userId) {
        throw new BadRequestException('تعذّر تحديد المستخدم لإنشاء فاتورة المشتريات.');
      }
      const canPurchase =
        hasPermission(caller.role || '', PERMISSIONS.PURCHASES_WRITE, caller.permissions) ||
        hasPermission(caller.role || '', PERMISSIONS.INVOICES_WRITE, caller.permissions);
      if (!canPurchase) {
        throw new ForbiddenException('لا تملك صلاحية تسجيل مشتريات محاسبية من اعتماد OCR.');
      }
      const totalNum = totalAmount != null ? Number(totalAmount) : Number(existing.totalAmount ?? 0);
      if (!totalNum || totalNum <= 0) {
        throw new BadRequestException('المبلغ الإجمالي مطلوب ويجب أن يكون أكبر من صفر لتسجيل فاتورة المشتريات.');
      }
      const isTaxable = purchase.isTaxable !== false;
      const supplierInvNo =
        purchase.supplierInvoiceNumber?.trim() ||
        (invoiceData.invoiceNumber as string | undefined)?.trim() ||
        existing.invoiceNumber?.trim() ||
        undefined;
      if (isTaxable && !supplierInvNo) {
        throw new BadRequestException('رقم فاتورة المورد مطلوب عند تسجيل مشترٍ خاضع للضريبة.');
      }
      const accSup = await this.prisma.supplier.findFirst({
        where: { id: purchase.accountingSupplierId, tenantId, companyId, isDeleted: false },
      });
      if (!accSup) throw new BadRequestException('مورد المحاسبة غير موجود أو غير نشط.');
      const vaulted = await this.prisma.vault.findFirst({
        where: { id: purchase.vaultId, tenantId, companyId },
      });
      if (!vaulted) throw new BadRequestException('الخزنة غير موجودة لهذه الشركة.');
    }

    let supplierId = invoiceData.supplierId || null;
    if (!supplierId && supplierName?.trim()) {
      const sup = await this.prisma.ocrSupplier.findFirst({
        where: { tenantId, companyId, nameAr: supplierName.trim() },
      });
      if (sup) supplierId = sup.id;
      else {
        const newSupplier = await this.prisma.ocrSupplier.create({
          data: { tenantId, companyId, nameAr: supplierName.trim() },
        });
        supplierId = newSupplier.id;
      }
    }

    const allCatalogItems = await this.prisma.ocrItem.findMany({
      where: { tenantId, companyId },
      include: { aliases: true },
    });
    const workCatalog = [...allCatalogItems];
    const processedLines = await processOcrLinesAgainstCatalog(
      this.prisma,
      tenantId,
      companyId,
      lines,
      workCatalog,
      this.logger,
    );

    const invoice = await this.prisma.ocrInvoice.update({
      where: { id },
      data: {
        supplierId,
        invoiceNumber: invoiceData.invoiceNumber || null,
        imageUrl: invoiceData.imageUrl ?? existing.imageUrl,
        rawExtraction: invoiceData.rawExtraction ? (invoiceData.rawExtraction as object) : undefined,
        notes: invoiceData.notes ?? null,
        subtotalAmount: (invoiceData as { subtotalAmount?: number }).subtotalAmount || null,
        totalAmount: totalAmount ? totalAmount : null,
        vatAmount: vatAmount ? vatAmount : null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        status: OcrInvoiceStatus.CONFIRMED,
        lines: {
          deleteMany: {},
          create: processedLines.map((l) => ({
            rawName: l.rawName,
            nameAr: (l as { nameAr?: string }).nameAr || null,
            nameEn: (l as { nameEn?: string }).nameEn || null,
            size: (l as { size?: string }).size || null,
            sizeUnit: (l as { sizeUnit?: string }).sizeUnit || null,
            itemId: l.itemId || null,
            quantity: l.quantity ? l.quantity : null,
            unitPrice: l.unitPrice ? l.unitPrice : null,
            totalPrice: l.totalPrice ? l.totalPrice : null,
            confidence: l.confidence ?? 0,
            matchStatus: l.matchStatus,
          })),
        },
      },
      include: { lines: true },
    });

    if (supplierId && invoiceDate) {
      const invEx2 = invoiceData as { subtotalAmount?: number };
      await recordOcrPriceHistoryForProcessedLines(
        this.prisma,
        tenantId,
        companyId,
        supplierId,
        invoiceDate,
        processedLines,
        invoice.id,
        {
          subtotalAmount: invEx2.subtotalAmount != null ? Number(invEx2.subtotalAmount) : null,
          totalAmount: totalAmount != null ? Number(totalAmount) : null,
          vatAmount: vatAmount != null ? Number(vatAmount) : null,
        },
      );
    }

    if (purchase && caller?.userId) {
      const totalNum = totalAmount != null ? Number(totalAmount) : Number(existing.totalAmount ?? 0);
      const isTaxable = purchase.isTaxable !== false;
      const supplierInvNo =
        purchase.supplierInvoiceNumber?.trim() ||
        (invoiceData.invoiceNumber as string | undefined)?.trim() ||
        existing.invoiceNumber?.trim() ||
        undefined;
      let invDateStr: string | undefined;
      if (invoiceDate) {
        invDateStr =
          typeof invoiceDate === 'string'
            ? invoiceDate.slice(0, 10)
            : new Date(invoiceDate as unknown as string).toISOString().slice(0, 10);
      } else if (existing.invoiceDate) {
        invDateStr = existing.invoiceDate.toISOString().slice(0, 10);
      }
      const noteParts = [`OCR:${id}`, invoiceData.notes as string | undefined].filter(Boolean) as string[];
      const notesJoined = noteParts.join(' — ').slice(0, 2000);

      const createDto: CreateInvoiceDto = {
        companyId,
        supplierId: purchase.accountingSupplierId,
        kind: 'purchase',
        totalAmount: totalNum,
        transactionDate: purchase.transactionDate.slice(0, 10),
        invoiceDate: invDateStr,
        vaultId: purchase.vaultId,
        supplierInvoiceNumber: supplierInvNo,
        isTaxable,
        notes: notesJoined,
        idempotencyKey: `ocr-purchase-${id}`,
      };

      const raw = await this.invoiceService.createWithLedger(createDto, caller.userId);
      await this.prisma.ocrInvoice.update({
        where: { id: invoice.id },
        data: { linkedPurchaseInvoiceId: raw.invoice.id },
      });
    }

    return this.prisma.ocrInvoice.findFirst({
      where: { id: invoice.id, tenantId, companyId },
      include: {
        supplier: { select: { id: true, nameAr: true, taxNumber: true } },
        lines: { include: { item: { select: { id: true, nameAr: true } } } },
        submittedBy: { select: { id: true, nameAr: true, email: true } },
        linkedPurchaseInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            transactionDate: true,
            kind: true,
          },
        },
      },
    });
  }
}
