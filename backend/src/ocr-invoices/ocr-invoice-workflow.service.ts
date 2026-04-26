/**
 * فواتير وتقارير وتنبيهات واعتماد المشتريات.
 */
import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaveInvoiceDto } from './dto/save-invoice.dto';
import { CreateInvoiceDto } from '../invoice/dto/create-invoice.dto';
import { InvoiceService } from '../invoice/invoice.service';
import { hasPermission, PERMISSIONS } from '../auth/constants/permissions';
import { OcrInvoiceStatus } from './ocr-invoice-status';
import { findBestItemMatch, normalizeItemForSearch } from './ocr-item-name-match.util';
import type { OcrSaveInvoiceCaller } from './ocr-invoices.types';

@Injectable()
export class OcrInvoiceWorkflowService {
  private readonly logger = new Logger(OcrInvoiceWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}


  // ─── Invoices CRUD ────────────────────────────────────────────────────────

  async getInvoices(tenantId: string, companyId: string) {
    if (!tenantId || !companyId) return [];
    return this.prisma.ocrInvoice.findMany({
      where: { tenantId, companyId },
      include: {
        supplier: { select: { id: true, nameAr: true } },
        lines: { include: { item: { select: { id: true, nameAr: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoiceById(tenantId: string, companyId: string, id: string) {
    const inv = await this.prisma.ocrInvoice.findFirst({
      where: { id, tenantId, companyId },
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
    if (!inv) throw new NotFoundException('الفاتورة غير موجودة.');
    return inv;
  }

  /**
   * اقتراح موردي المحاسبة لمطابقة مورد OCR (اسم / الرقم الضريبي).
   * يدعم `q` مع `ocrSupplierId` معاً (اسم من الفاتورة + سجل كتالوج OCR).
   * إن وُجد `accountingSupplierId` على مورد OCR يُعاد ذلك المورد أولاً.
   */
  async getAccountingSupplierSuggestions(
    tenantId: string,
    companyId: string,
    opts: { ocrSupplierId?: string; q?: string; invoiceVat?: string; limit?: number },
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 16, 1), 50);
    const qTrim = (opts.q || '').trim();
    let needleAr = qTrim;
    let needleEn = '';
    /** الرقم الضريبي من الفاتورة يُفضَّل على رقم كتالوج OCR للمطابقة */
    const invVatDigits = (opts.invoiceVat || '').replace(/\D/g, '');
    let taxDigits: string | null = invVatDigits.length >= 9 ? invVatDigits : null;
    let linkedAccountingId: string | null = null;
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    if (opts.ocrSupplierId) {
      const o = await this.prisma.ocrSupplier.findFirst({
        where: { id: opts.ocrSupplierId, tenantId, companyId },
        select: {
          nameAr: true,
          nameEn: true,
          taxNumber: true,
          accountingSupplierId: true,
        },
      });
      if (o) {
        linkedAccountingId = o.accountingSupplierId || null;
        const catAr = (o.nameAr || '').trim();
        const catEn = (o.nameEn || '').trim();
        if (!needleAr) needleAr = catAr;
        else if (catAr) needleAr = `${needleAr} ${catAr}`.trim();
        needleEn = catEn;
        const raw = o.taxNumber?.replace(/\D/g, '') || '';
        const ocrTax = raw.length >= 9 ? raw : null;
        if (!taxDigits && ocrTax) taxDigits = ocrTax;
      }
    }
    const na = norm(needleAr);
    const ne = norm(needleEn);
    const tokens = na.split(' ').filter((t) => t.length >= 2);

    if (!na && !ne && !taxDigits) {
      if (linkedAccountingId) {
        const lone = await this.prisma.supplier.findFirst({
          where: { id: linkedAccountingId, tenantId, companyId, isDeleted: false },
          select: { id: true, nameAr: true, nameEn: true, taxNumber: true },
        });
        return lone
          ? [{ ...lone, matchScore: 10000, linkedFromOcr: true as const }]
          : [];
      }
      return [];
    }

    const suppliers = await this.prisma.supplier.findMany({
      where: { tenantId, companyId, isDeleted: false },
      select: { id: true, nameAr: true, nameEn: true, taxNumber: true },
      take: 600,
    });

    const scored = suppliers.map((s) => {
      let score = 0;
      const ar = norm(s.nameAr);
      const en = s.nameEn ? norm(s.nameEn) : '';
      const stax = s.taxNumber?.replace(/\D/g, '') || '';
      if (taxDigits && stax && stax === taxDigits) score += 120;
      if (na && ar === na) score += 80;
      else if (na.length >= 2 && ar.includes(na)) score += 50;
      else if (na.length >= 2 && na.includes(ar) && ar.length >= 3) score += 42;
      else if (na.length >= 2 && ar.includes(na.slice(0, Math.min(12, na.length)))) score += 28;
      if (ne.length >= 2 && en.includes(ne)) score += 35;
      else if (ne.length >= 2 && ne.includes(en) && en.length >= 3) score += 22;
      for (const tok of tokens) {
        if (tok.length >= 2 && ar.includes(tok)) score += 12;
        if (tok.length >= 2 && en.includes(tok)) score += 10;
      }
      return { id: s.id, nameAr: s.nameAr, nameEn: s.nameEn, taxNumber: s.taxNumber, score };
    });

    let list = scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ score, ...rest }) => ({ ...rest, matchScore: score }));

    if (list.length < limit && na.length >= 2) {
      const prefix = na.slice(0, Math.min(8, na.length));
      const extra = await this.prisma.supplier.findMany({
        where: {
          tenantId,
          companyId,
          isDeleted: false,
          OR: [
            { nameAr: { contains: prefix, mode: 'insensitive' } },
            { nameEn: { contains: prefix, mode: 'insensitive' } },
          ],
          NOT: { id: { in: list.map((x) => x.id) } },
        },
        select: { id: true, nameAr: true, nameEn: true, taxNumber: true },
        take: limit - list.length,
      });
      list = [
        ...list,
        ...extra.map((s) => ({
          id: s.id,
          nameAr: s.nameAr,
          nameEn: s.nameEn,
          taxNumber: s.taxNumber,
          matchScore: 5,
        })),
      ];
    }

    if (linkedAccountingId) {
      const linked = suppliers.find((s) => s.id === linkedAccountingId);
      if (linked) {
        const rest = list.filter((x) => x.id !== linked.id);
        list = [
          {
            id: linked.id,
            nameAr: linked.nameAr,
            nameEn: linked.nameEn,
            taxNumber: linked.taxNumber,
            matchScore: 10000,
            linkedFromOcr: true as boolean,
          } as (typeof list)[number],
          ...rest,
        ];
      }
    }

    return list.slice(0, limit);
  }

  /**
   * تقرير فواتير OCR في شهر (حسب تاريخ الفاتورة أو تاريخ الإنشاء) مع أصناف وفئات.
   */
  async getPurchasesMonthlyReport(tenantId: string, companyId: string, month: string) {
    const m = /^(\d{4})-(\d{2})$/.exec((month || '').trim());
    if (!m) throw new BadRequestException('month مطلوب بصيغة YYYY-MM');
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    if (mo < 1 || mo > 12) throw new BadRequestException('شهر غير صالح');
    const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
    const endEx = new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));

    const invoices = await this.prisma.ocrInvoice.findMany({
      where: {
        tenantId,
        companyId,
        OR: [
          { AND: [{ invoiceDate: { not: null } }, { invoiceDate: { gte: start, lt: endEx } }] },
          { AND: [{ invoiceDate: null }, { createdAt: { gte: start, lt: endEx } }] },
        ],
      },
      include: {
        supplier: { select: { id: true, nameAr: true, accountingSupplierId: true } },
        lines: {
          include: {
            item: { select: { id: true, nameAr: true, category: true } },
          },
        },
        linkedPurchaseInvoice: { select: { id: true, invoiceNumber: true } },
      },
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
    });

    type CatAgg = { category: string; lineCount: number; total: Prisma.Decimal };
    const byCategory = new Map<string, CatAgg>();
    type ItemAgg = {
      itemId: string | null;
      nameAr: string;
      category: string | null;
      lineCount: number;
      quantity: Prisma.Decimal;
      total: Prisma.Decimal;
    };
    const byItem = new Map<string, ItemAgg>();

    let lineTotalAll = new Prisma.Decimal(0);
    let lineCountAll = 0;

    for (const inv of invoices) {
      for (const line of inv.lines) {
        lineCountAll += 1;
        const tp = line.totalPrice ?? new Prisma.Decimal(0);
        lineTotalAll = lineTotalAll.add(tp);
        const cat = line.item?.category?.trim() || '—';
        const prevC = byCategory.get(cat) || { category: cat, lineCount: 0, total: new Prisma.Decimal(0) };
        prevC.lineCount += 1;
        prevC.total = prevC.total.add(tp);
        byCategory.set(cat, prevC);

        const itemKey = line.itemId || `raw:${line.rawName}`;
        const nameAr = line.item?.nameAr || line.nameAr || line.rawName || '—';
        const itemCat = line.item?.category ?? null;
        const prevI = byItem.get(itemKey) || {
          itemId: line.itemId,
          nameAr,
          category: itemCat,
          lineCount: 0,
          quantity: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
        };
        prevI.lineCount += 1;
        if (line.quantity) prevI.quantity = prevI.quantity.add(line.quantity);
        prevI.total = prevI.total.add(tp);
        byItem.set(itemKey, prevI);
      }
    }

    return {
      month: `${y}-${String(mo).padStart(2, '0')}`,
      invoiceCount: invoices.length,
      lineCount: lineCountAll,
      grandTotal: lineTotalAll.toNumber(),
      byCategory: [...byCategory.values()]
        .map((c) => ({ category: c.category, lineCount: c.lineCount, total: c.total.toNumber() }))
        .sort((a, b) => b.total - a.total),
      byItem: [...byItem.values()]
        .map((it) => ({
          itemId: it.itemId,
          nameAr: it.nameAr,
          category: it.category,
          lineCount: it.lineCount,
          quantity: it.quantity.toNumber(),
          total: it.total.toNumber(),
        }))
        .sort((a, b) => b.total - a.total),
      invoices: invoices.map((i) => ({
        id: i.id,
        status: i.status,
        invoiceNumber: i.invoiceNumber,
        invoiceDate: i.invoiceDate,
        createdAt: i.createdAt,
        totalAmount: i.totalAmount?.toNumber() ?? null,
        supplier: i.supplier,
        lineCount: i.lines.length,
        linkedPurchaseId: i.linkedPurchaseInvoiceId,
        linkedPurchase: i.linkedPurchaseInvoice,
      })),
    };
  }

  async saveInvoice(tenantId: string, companyId: string, dto: SaveInvoiceDto, caller?: OcrSaveInvoiceCaller) {
    if (dto.purchase && !dto.id) {
      throw new BadRequestException('ربط فاتورة مشتريات متاح فقط عند اعتماد فاتورة من المراجعة (معرّف السجل).');
    }
    if (dto.id) {
      return this.finalizePendingReviewInvoice(tenantId, companyId, dto, caller);
    }

    const { lines, invoiceDate, totalAmount, vatAmount, supplierName, purchase: _purchase, ...invoiceData } = dto;
    void _purchase;

    // ── 1. إنشاء المورد تلقائياً إذا لم يكن موجوداً ───────────────────────
    let supplierId = invoiceData.supplierId || null;
    if (!supplierId && supplierName?.trim()) {
      // تحقق أولاً إذا كان المورد موجوداً بنفس الاسم لتجنب التكرار
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

    // ── 2. إنشاء الأصناف تلقائياً لكل سطر ليس له itemId ─────────────────
    // جلب جميع الأصناف مرة واحدة للمطابقة الذكية (بدلاً من استعلام لكل سطر)
    const allCatalogItems = await this.prisma.ocrItem.findMany({
      where: { tenantId, companyId },
      include: { aliases: true },
    });

    const processedLines = await Promise.all(
      lines.map(async (line) => {
        let itemId = line.itemId || null;
        if (!itemId && line.rawName?.trim()) {
          // استخدم الاسم النظيف من الـ frontend إن وُجد، أو استخرجه من rawName
          const lineExt = line as {
            nameAr?: string; nameEn?: string;
            size?: string;   sizeUnit?: string;
          };
          const nameAr   = lineExt.nameAr?.trim()   || null;
          const nameEn   = lineExt.nameEn?.trim()   || null;
          const lineSize = lineExt.size              || null;

          // إذا لم تأتِ أسماء نظيفة — استخرجها من rawName
          let searchName: string;
          if (nameAr || nameEn) {
            searchName = nameAr || nameEn!;
          } else {
            const extracted = normalizeItemForSearch(line.rawName.trim());
            searchName = extracted.ar || extracted.en || line.rawName.trim();
          }

          // مطابقة ذكية ضد كتالوج الأصناف
          const matchResult = findBestItemMatch(searchName, allCatalogItems);

          if (matchResult && matchResult.score >= 0.78) {
            // صنف موجود بتشابه كافٍ — لا نُنشئ مكرراً
            itemId = matchResult.item.id;
            if (lineSize) {
              await this.prisma.ocrItem.update({
                where: { id: itemId },
                data: { hasSizes: true },
              }).catch(() => {});
            }
            this.logger.log(
              `Smart-matched item "${searchName}" → "${matchResult.item.nameAr}" (score: ${matchResult.score.toFixed(2)})`,
            );
          } else {
            // صنف جديد — نُخزّن الاسم النظيف (لا rawName الفوضوي)
            const cleanAr = nameAr || (normalizeItemForSearch(line.rawName.trim()).ar) || line.rawName.trim();
            const cleanEn = nameEn || (normalizeItemForSearch(line.rawName.trim()).en) || null;

            const newItem = await this.prisma.ocrItem.create({
              data: {
                tenantId,
                companyId,
                nameAr:   cleanAr,
                nameEn:   cleanEn,
                hasSizes: !!lineSize,
              },
            });
            itemId = newItem.id;

            // أضف rawName كـ alias للمساعدة في المطابقات المستقبلية
            const rawTrimmed = line.rawName.trim();
            if (rawTrimmed !== cleanAr) {
              await this.prisma.ocrItemAlias.create({
                data: { itemId, alias: rawTrimmed, language: 'ar', addedBy: 'ocr-auto' },
              }).catch(() => {});
            }
            // أضف العبوة الكاملة (مثل "4x2.5-kg") alias أيضاً إن اختلفت
            allCatalogItems.push({ ...newItem, nameEn: cleanEn, hasSizes: !!lineSize, aliases: [] });
            this.logger.log(`Auto-created OCR item: "${cleanAr}" (${newItem.id})`);
          }
        }
        return {
          ...line,
          itemId,
          matchStatus: itemId && line.itemId ? (line.matchStatus || 'matched') : itemId ? 'new' : 'pending',
        };
      }),
    );

    // ── 3. حفظ الفاتورة مع السطور ────────────────────────────────────────
    const invoice = await this.prisma.ocrInvoice.create({
      data: {
        tenantId,
        companyId,
        supplierId,
        invoiceNumber:  invoiceData.invoiceNumber  || null,
        imageUrl:       invoiceData.imageUrl        || null,
        rawExtraction:  invoiceData.rawExtraction ? (invoiceData.rawExtraction as object) : undefined,
        notes:          invoiceData.notes           || null,
        subtotalAmount: (invoiceData as { subtotalAmount?: number }).subtotalAmount || null,
        totalAmount:    totalAmount ? totalAmount   : null,
        vatAmount:      vatAmount   ? vatAmount     : null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        status: OcrInvoiceStatus.CONFIRMED,
        lines: {
          create: processedLines.map((l) => ({
            rawName:     l.rawName,
            nameAr:      (l as { nameAr?: string }).nameAr || null,
            nameEn:      (l as { nameEn?: string }).nameEn || null,
            size:        (l as { size?: string }).size || null,
            sizeUnit:    (l as { sizeUnit?: string }).sizeUnit || null,
            itemId:      l.itemId || null,
            quantity:    l.quantity ? l.quantity : null,
            unitPrice:   l.unitPrice ? l.unitPrice : null,
            totalPrice:  l.totalPrice ? l.totalPrice : null,
            confidence:  l.confidence ?? 0,
            matchStatus: l.matchStatus,
          })),
        },
      },
      include: { lines: true },
    });

    // ── 4. حفظ تاريخ الأسعار لكل صنف له مورد وسعر ──────────────────────
    // يُطبِّع الأسعار إلى أساس "خالص الضريبة" قبل الحفظ لضمان مقارنة عادلة.
    //
    // الفواتير السعودية تختلف: بعضها يسجّل سعر الوحدة بدون ضريبة وبعضها بضريبة.
    // الحل: احسب مجموع أسعار السطور وقارنه بالمجموع قبل الضريبة (subtotal) وبعده (total):
    //   – إذا كان يتوافق مع total → الأسعار شاملة الضريبة → قسِّم على (1 + معدل الضريبة)
    //   – إذا كان يتوافق مع subtotal → الأسعار خالصة الضريبة → لا تعديل
    if (supplierId && invoiceDate) {
      // احسب مجموع (سعر الوحدة × الكمية) من السطور
      const lineSum = processedLines.reduce((s, l) => {
        const up = Number(l.unitPrice) || 0;
        const qty = Number(l.quantity)  || 1;
        return s + up * qty;
      }, 0);

      const invoiceExt = invoiceData as { subtotalAmount?: number };
      const subTotal   = invoiceExt.subtotalAmount ? Number(invoiceExt.subtotalAmount) : null;
      const grandTotal = totalAmount ? Number(totalAmount) : null;
      const vatAmt     = vatAmount   ? Number(vatAmount)   : null;

      // معدل الضريبة الضمني
      const impliedVatRate: number = (() => {
        if (vatAmt && subTotal && subTotal > 0) return vatAmt / subTotal;
        if (vatAmt && grandTotal && grandTotal > vatAmt) return vatAmt / (grandTotal - vatAmt);
        return 0.15; // الافتراضي للمملكة
      })();

      // هل أسعار السطور شاملة الضريبة؟
      let normFactor = 1.0;
      if (vatAmt && vatAmt > 0 && lineSum > 0) {
        if (subTotal && grandTotal) {
          const diffFromSubtotal = Math.abs(lineSum - subTotal) / subTotal;
          const diffFromTotal    = Math.abs(lineSum - grandTotal) / grandTotal;
          if (diffFromTotal < diffFromSubtotal && diffFromTotal < 0.06) {
            normFactor = 1 / (1 + impliedVatRate);
          }
        } else if (grandTotal) {
          const diffFromTotal = Math.abs(lineSum - grandTotal) / grandTotal;
          if (diffFromTotal < 0.06) normFactor = 1 / (1 + impliedVatRate);
        }
      }

      for (const line of processedLines) {
        if (line.itemId && line.unitPrice) {
          const normalizedPrice = Math.round(Number(line.unitPrice) * normFactor * 1000) / 1000;
          await this.prisma.ocrPriceHistory.create({
            data: {
              tenantId,
              companyId,
              itemId:      line.itemId,
              supplierId,
              price:       normalizedPrice,
              size:        (line as { size?: string }).size     || null,
              sizeUnit:    (line as { sizeUnit?: string }).sizeUnit || null,
              invoiceDate: new Date(invoiceDate),
              invoiceId:   invoice.id,
            },
          });
        }
      }
    }

    return invoice;
  }

  /** اعتماد فاتورة كانت بانتظار المراجعة بعد تعديل المحاسب — نفس منطق saveInvoice على نفس السجل */
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
      const totalNum =
        totalAmount != null ? Number(totalAmount) : Number(existing.totalAmount ?? 0);
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

    const processedLines = await Promise.all(
      lines.map(async (line) => {
        let itemId = line.itemId || null;
        if (!itemId && line.rawName?.trim()) {
          const lineExt = line as {
            nameAr?: string; nameEn?: string;
            size?: string;   sizeUnit?: string;
          };
          const nameAr   = lineExt.nameAr?.trim()   || null;
          const nameEn   = lineExt.nameEn?.trim()   || null;
          const lineSize = lineExt.size              || null;
          let searchName: string;
          if (nameAr || nameEn) {
            searchName = nameAr || nameEn!;
          } else {
            const extracted = normalizeItemForSearch(line.rawName.trim());
            searchName = extracted.ar || extracted.en || line.rawName.trim();
          }
          const matchResult = findBestItemMatch(searchName, allCatalogItems);
          if (matchResult && matchResult.score >= 0.78) {
            itemId = matchResult.item.id;
            if (lineSize) {
              await this.prisma.ocrItem.update({
                where: { id: itemId },
                data: { hasSizes: true },
              }).catch(() => {});
            }
          } else {
            const cleanAr = nameAr || (normalizeItemForSearch(line.rawName.trim()).ar) || line.rawName.trim();
            const cleanEn = nameEn || (normalizeItemForSearch(line.rawName.trim()).en) || null;
            const newItem = await this.prisma.ocrItem.create({
              data: {
                tenantId,
                companyId,
                nameAr:   cleanAr,
                nameEn:   cleanEn,
                hasSizes: !!lineSize,
              },
            });
            itemId = newItem.id;
            const rawTrimmed = line.rawName.trim();
            if (rawTrimmed !== cleanAr) {
              await this.prisma.ocrItemAlias.create({
                data: { itemId, alias: rawTrimmed, language: 'ar', addedBy: 'ocr-auto' },
              }).catch(() => {});
            }
            allCatalogItems.push({ ...newItem, nameEn: cleanEn, hasSizes: !!lineSize, aliases: [] });
          }
        }
        return {
          ...line,
          itemId,
          matchStatus: itemId && line.itemId ? (line.matchStatus || 'matched') : itemId ? 'new' : 'pending',
        };
      }),
    );

    const invoice = await this.prisma.ocrInvoice.update({
      where: { id },
      data: {
        supplierId,
        invoiceNumber:  invoiceData.invoiceNumber  || null,
        imageUrl:       invoiceData.imageUrl        ?? existing.imageUrl,
        rawExtraction:  invoiceData.rawExtraction ? (invoiceData.rawExtraction as object) : undefined,
        notes:          invoiceData.notes           ?? null,
        subtotalAmount: (invoiceData as { subtotalAmount?: number }).subtotalAmount || null,
        totalAmount:    totalAmount ? totalAmount   : null,
        vatAmount:      vatAmount   ? vatAmount     : null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        status: OcrInvoiceStatus.CONFIRMED,
        lines: {
          deleteMany: {},
          create: processedLines.map((l) => ({
            rawName:     l.rawName,
            nameAr:      (l as { nameAr?: string }).nameAr || null,
            nameEn:      (l as { nameEn?: string }).nameEn || null,
            size:        (l as { size?: string }).size || null,
            sizeUnit:    (l as { sizeUnit?: string }).sizeUnit || null,
            itemId:      l.itemId || null,
            quantity:    l.quantity ? l.quantity : null,
            unitPrice:   l.unitPrice ? l.unitPrice : null,
            totalPrice:  l.totalPrice ? l.totalPrice : null,
            confidence:  l.confidence ?? 0,
            matchStatus: l.matchStatus,
          })),
        },
      },
      include: { lines: true },
    });

    if (supplierId && invoiceDate) {
      const lineSum = processedLines.reduce((s, l) => {
        const up = Number(l.unitPrice) || 0;
        const qty = Number(l.quantity)  || 1;
        return s + up * qty;
      }, 0);
      const invoiceExt = invoiceData as { subtotalAmount?: number };
      const subTotal   = invoiceExt.subtotalAmount ? Number(invoiceExt.subtotalAmount) : null;
      const grandTotal = totalAmount ? Number(totalAmount) : null;
      const vatAmt     = vatAmount   ? Number(vatAmount)   : null;
      const impliedVatRate: number = (() => {
        if (vatAmt && subTotal && subTotal > 0) return vatAmt / subTotal;
        if (vatAmt && grandTotal && grandTotal > vatAmt) return vatAmt / (grandTotal - vatAmt);
        return 0.15;
      })();
      let normFactor = 1.0;
      if (vatAmt && vatAmt > 0 && lineSum > 0) {
        if (subTotal && grandTotal) {
          const diffFromSubtotal = Math.abs(lineSum - subTotal) / subTotal;
          const diffFromTotal    = Math.abs(lineSum - grandTotal) / grandTotal;
          if (diffFromTotal < diffFromSubtotal && diffFromTotal < 0.06) {
            normFactor = 1 / (1 + impliedVatRate);
          }
        } else if (grandTotal) {
          const diffFromTotal = Math.abs(lineSum - grandTotal) / grandTotal;
          if (diffFromTotal < 0.06) normFactor = 1 / (1 + impliedVatRate);
        }
      }
      for (const line of processedLines) {
        if (line.itemId && line.unitPrice) {
          const normalizedPrice = Math.round(Number(line.unitPrice) * normFactor * 1000) / 1000;
          await this.prisma.ocrPriceHistory.create({
            data: {
              tenantId,
              companyId,
              itemId:      line.itemId,
              supplierId,
              price:       normalizedPrice,
              size:        (line as { size?: string }).size     || null,
              sizeUnit:    (line as { sizeUnit?: string }).sizeUnit || null,
              invoiceDate: new Date(invoiceDate),
              invoiceId:   invoice.id,
            },
          });
        }
      }
    }

    if (purchase && caller?.userId) {
      const totalNum =
        totalAmount != null ? Number(totalAmount) : Number(existing.totalAmount ?? 0);
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

  async confirmInvoice(tenantId: string, companyId: string, id: string, status: string) {
    const row = await this.prisma.ocrInvoice.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('الفاتورة غير موجودة.');
    return this.prisma.ocrInvoice.update({
      where: { id },
      data: { status },
    });
  }

  async bulkDeleteInvoices(tenantId: string, companyId: string, ids: string[]) {
    if (!ids?.length) return { count: 0 };
    const result = await this.prisma.ocrInvoice.deleteMany({
      where: { id: { in: ids }, tenantId, companyId },
    });
    return { count: result.count };
  }

  async bulkDeleteSuppliers(tenantId: string, companyId: string, ids: string[]) {
    if (!ids?.length) return { count: 0 };
    const result = await this.prisma.ocrSupplier.deleteMany({
      where: { id: { in: ids }, tenantId, companyId },
    });
    return { count: result.count };
  }

  async bulkDeleteItems(tenantId: string, companyId: string, ids: string[]) {
    if (!ids?.length) return { count: 0 };
    const result = await this.prisma.ocrItem.deleteMany({
      where: { id: { in: ids }, tenantId, companyId },
    });
    return { count: result.count };
  }

  async bulkDeletePriceHistory(tenantId: string, companyId: string, itemIds: string[]) {
    if (!itemIds?.length) return { count: 0 };
    const result = await this.prisma.ocrPriceHistory.deleteMany({
      where: { itemId: { in: itemIds }, tenantId, companyId },
    });
    return { count: result.count };
  }

  // ─── Price Alerts ─────────────────────────────────────────────────────────

  async getPriceAlerts(tenantId: string, companyId: string) {
    if (!tenantId || !companyId) return [];
    const history = await this.prisma.ocrPriceHistory.findMany({
      where: { tenantId, companyId },
      include: {
        item: { select: { id: true, nameAr: true, category: true } },
        supplier: { select: { id: true, nameAr: true } },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    // تجميع بالصنف
    const byItem = new Map<string, typeof history>();
    for (const h of history) {
      if (!byItem.has(h.itemId)) byItem.set(h.itemId, []);
      byItem.get(h.itemId)!.push(h);
    }

    const alerts: Array<{
      itemId: string;
      itemName: string;
      category: string | null;
      latestPrice: number;
      latestSupplier: string;
      latestInvoiceId: string | null;
      latestInvoiceDate: Date;
      lowestPrice: number;
      lowestSupplier: string;
      lowestInvoiceId: string | null;
      lowestInvoiceDate: Date;
      averagePrice: number;
      priceIncreasePercent: number;
    }> = [];

    for (const [, entries] of byItem) {
      if (entries.length < 2) continue;
      const latest = entries[0];
      const latestPrice = Number(latest.price);
      const allPrices = entries.map((e) => Number(e.price));
      const lowestPrice = Math.min(...allPrices);
      const lowestEntry = entries.find((e) => Number(e.price) === lowestPrice)!;
      const avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;

      // تجاهل التنبيهات التي تعكس فارق الضريبة فقط (≈ 15%)
      // مثال: 189.75 vs 165 → 189.75/165 = 1.15 → فارق الضريبة وليس ارتفاع سعر حقيقي
      const VAT_RATE = 0.15;
      const isVatArtifact =
        Math.abs(latestPrice / lowestPrice - (1 + VAT_RATE)) / (1 + VAT_RATE) < 0.02 ||
        Math.abs(lowestPrice / latestPrice - (1 + VAT_RATE)) / (1 + VAT_RATE) < 0.02;

      if (latestPrice > lowestPrice * 1.05 && !isVatArtifact) {
        alerts.push({
          itemId: latest.itemId,
          itemName: latest.item.nameAr,
          category: latest.item.category,
          latestPrice,
          latestSupplier: latest.supplier.nameAr,
          latestInvoiceId: latest.invoiceId ?? null,
          latestInvoiceDate: latest.invoiceDate,
          lowestPrice,
          lowestSupplier: lowestEntry.supplier.nameAr,
          lowestInvoiceId: lowestEntry.invoiceId ?? null,
          lowestInvoiceDate: lowestEntry.invoiceDate,
          averagePrice: Math.round(avgPrice * 100) / 100,
          priceIncreasePercent: Math.round(((latestPrice - lowestPrice) / lowestPrice) * 100),
        });
      }
    }

    return alerts.sort((a, b) => b.priceIncreasePercent - a.priceIncreasePercent);
  }

  // ─── Correction Rules ─────────────────────────────────────────────────────

  async getCorrectionRules(tenantId: string, companyId: string) {
    return this.prisma.ocrCorrectionRule.findMany({
      where: { tenantId, companyId },
      include: { supplier: { select: { id: true, nameAr: true } } },
      orderBy: { occurrences: 'desc' },
    });
  }

  async updateCorrectionRule(tenantId: string, companyId: string, id: string, status: string) {
    const row = await this.prisma.ocrCorrectionRule.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('القاعدة غير موجودة.');
    return this.prisma.ocrCorrectionRule.update({
      where: { id },
      data: { status },
    });
  }
}
