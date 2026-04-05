import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getGeminiApiKey, getGeminiModel } from '../config/gemini.config';
import { normalize } from './ocr-normalize.util';
import { findBestMatch, classifyConfidence } from './ocr-match.util';
import { ExtractInvoiceDto } from './dto/extract-invoice.dto';
import { CreateOcrSupplierDto } from './dto/create-ocr-supplier.dto';
import { CreateOcrItemDto } from './dto/create-ocr-item.dto';
import { SaveInvoiceDto } from './dto/save-invoice.dto';

function getGeminiUrl(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent`;
}

function extractJson<T = Record<string, unknown>>(text: string): T | null {
  let t = (text || '').trim();
  const codeMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) t = codeMatch[1].trim();
  try { return JSON.parse(t) as T; } catch { /* */ }
  const start = t.indexOf('{');
  if (start === -1) return null;
  let depth = 0, end = -1;
  for (let i = start; i < t.length; i++) {
    if (t[i] === '{') depth++;
    else if (t[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  try { return JSON.parse(t.slice(start, end + 1)) as T; } catch { return null; }
}

interface GeminiExtractedInvoice {
  supplier?: { name?: string; confidence?: number };
  vatNumber?: { value?: string; confidence?: number };
  invoiceNumber?: { value?: string; confidence?: number };
  invoiceDate?: { value?: string; confidence?: number };
  totalAmount?: { value?: number; confidence?: number };
  vatAmount?: { value?: number; confidence?: number };
  items?: Array<{
    name?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    confidence?: number;
  }>;
}

const OCR_EXTRACTION_PROMPT = `أنت خبير استخراج بيانات الفواتير التجارية السعودية.
استخرج البيانات من هذه الفاتورة وأرجع JSON صحيحاً بهذا الشكل الدقيق:

{
  "supplier": { "name": "اسم المورد أو الشركة البائعة", "confidence": 0.95 },
  "vatNumber": { "value": "الرقم الضريبي (15 رقم)", "confidence": 0.9 },
  "invoiceNumber": { "value": "رقم الفاتورة", "confidence": 0.95 },
  "invoiceDate": { "value": "YYYY-MM-DD", "confidence": 0.95 },
  "totalAmount": { "value": 1500.00, "confidence": 0.98 },
  "vatAmount": { "value": 195.65, "confidence": 0.98 },
  "items": [
    {
      "name": "اسم الصنف كما هو في الفاتورة",
      "quantity": 5,
      "unitPrice": 60.00,
      "totalPrice": 300.00,
      "confidence": 0.90
    }
  ]
}

قواعد مهمة:
- confidence من 0 إلى 1 (1 = متأكد تماماً)
- إذا لم تجد قيمة، اجعلها null وconfidence = 0
- أرقام الفاتورة كما هي بدون تعديل
- أسماء الأصناف كما هي في الفاتورة تماماً
- التاريخ بصيغة YYYY-MM-DD دائماً
- المبالغ أرقام عشرية فقط (بدون عملة)
- أرجع JSON فقط بدون أي نص قبله أو بعده`;

@Injectable()
export class OcrInvoicesService {
  private readonly logger = new Logger(OcrInvoicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Gemini Vision OCR ────────────────────────────────────────────────────

  async extractInvoice(tenantId: string, dto: ExtractInvoiceDto) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new BadRequestException('Gemini API key not configured');

    const mimeType = dto.mimeType || 'image/jpeg';
    const url = `${getGeminiUrl()}?key=${apiKey}`;

    const body = {
      contents: [{
        parts: [
          { text: OCR_EXTRACTION_PROMPT },
          { inlineData: { mimeType, data: dto.imageBase64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const rawJson = await res.json().catch(() => null) as Record<string, unknown> | null;

    if (!res.ok) {
      const errMsg = (rawJson as { error?: { message?: string } })?.error?.message || res.statusText;
      this.logger.error(`Gemini OCR error ${res.status}: ${errMsg}`);
      throw new BadRequestException(`فشل الاستخراج من Gemini: ${errMsg}`);
    }

    const candidates = (rawJson as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates;
    const text = candidates?.[0]?.content?.parts?.[0]?.text || '';

    this.logger.log(`Gemini OCR raw: ${text.substring(0, 200)}`);

    const extracted = extractJson<GeminiExtractedInvoice>(text);

    if (!extracted) {
      this.logger.error(`Gemini OCR parse failed. Raw text (first 800): ${text.substring(0, 800)}`);
      // أرجع كائناً فارغاً مع علامة الخطأ بدلاً من رمي استثناء
      return {
        parseError: true,
        rawText: text.substring(0, 500),
        supplier: null,
        supplierMatch: null,
        vatNumber: null,
        invoiceNumber: null,
        invoiceDate: null,
        totalAmount: null,
        vatAmount: null,
        items: [],
      };
    }

    // حاول مطابقة المورد والأصناف
    const enriched = await this.enrichExtraction(tenantId, extracted);
    return enriched;
  }

  private async enrichExtraction(tenantId: string, extracted: GeminiExtractedInvoice) {
    const suppliers = await this.prisma.ocrSupplier.findMany({
      where: { tenantId },
      include: { aliases: true },
    });

    const items = await this.prisma.ocrItem.findMany({
      where: { tenantId },
      include: { aliases: true },
    });

    // مطابقة المورد
    let supplierMatch: { id: string; nameAr: string; score: number; status: string } | null = null;

    const supplierName = extracted.supplier?.name;
    if (supplierName) {
      // تحقق من الرقم الضريبي أولاً
      const vatVal = extracted.vatNumber?.value;
      const vatConf = extracted.vatNumber?.confidence ?? 0;
      if (vatVal && vatConf >= 0.9) {
        const byVat = suppliers.find((s) => s.taxNumber && normalize(s.taxNumber) === normalize(vatVal));
        if (byVat) {
          supplierMatch = { id: byVat.id, nameAr: byVat.nameAr, score: 1, status: 'auto' };
        }
      }

      if (!supplierMatch) {
        const result = findBestMatch(
          supplierName,
          suppliers,
          (s) => s.nameAr,
          (s) => s.aliases.map((a) => a.alias),
        );
        if (result) {
          const status = classifyConfidence(result.score);
          if (status !== 'new') {
            supplierMatch = {
              id: (result.item as { id: string }).id,
              nameAr: (result.item as { nameAr: string }).nameAr,
              score: result.score,
              status: status === 'auto' ? 'auto' : 'review',
            };
          }
        }
      }

      // سجّل في extraction log
      await this.logExtraction(tenantId, 'supplier', supplierName, supplierMatch);
    }

    // مطابقة الأصناف
    const matchedItems = await Promise.all(
      (extracted.items || []).map(async (item) => {
        if (!item.name) return { ...item, itemMatch: null };

        const result = findBestMatch(
          item.name,
          items,
          (i) => i.nameAr,
          (i) => i.aliases.map((a) => a.alias),
        );

        let itemMatch: { id: string; nameAr: string; score: number; status: string } | null = null;
        if (result) {
          const status = classifyConfidence(result.score);
          if (status !== 'new') {
            itemMatch = {
              id: (result.item as { id: string }).id,
              nameAr: (result.item as { nameAr: string }).nameAr,
              score: result.score,
              status: status === 'auto' ? 'auto' : 'review',
            };
          }
        }

        await this.logExtraction(tenantId, 'item', item.name, itemMatch, supplierMatch?.id);
        return { ...item, itemMatch };
      }),
    );

    return {
      supplier: extracted.supplier,
      supplierMatch,
      vatNumber: extracted.vatNumber,
      invoiceNumber: extracted.invoiceNumber,
      invoiceDate: extracted.invoiceDate,
      totalAmount: extracted.totalAmount,
      vatAmount: extracted.vatAmount,
      items: matchedItems,
    };
  }

  private async logExtraction(
    tenantId: string,
    entityType: string,
    extractedText: string,
    resolved: { id: string; nameAr: string; score: number } | null,
    supplierId?: string,
  ) {
    const normText = normalize(extractedText);
    const existing = await this.prisma.ocrExtractionLog.findFirst({
      where: { tenantId, entityType, extractedText: normText, supplierId: supplierId || null },
    });

    if (existing) {
      await this.prisma.ocrExtractionLog.update({
        where: { id: existing.id },
        data: {
          occurrences: { increment: 1 },
          resolvedToId: resolved?.id,
          resolvedText: resolved?.nameAr,
          confidence: resolved?.score ?? 0,
        },
      });

      // إذا تكررت 3 مرات وكان التشابه ≥80% — أنشئ correction rule
      if (
        existing.occurrences >= 2 &&
        resolved &&
        resolved.score >= 0.8 &&
        resolved.score < 0.98
      ) {
        await this.upsertCorrectionRule(tenantId, entityType, normText, resolved.nameAr, supplierId);
      }
    } else {
      await this.prisma.ocrExtractionLog.create({
        data: {
          tenantId,
          entityType,
          extractedText: normText,
          normalizedText: normText,
          resolvedToId: resolved?.id,
          resolvedText: resolved?.nameAr,
          confidence: resolved?.score ?? 0,
          supplierId: supplierId || null,
        },
      });
    }
  }

  private async upsertCorrectionRule(
    tenantId: string,
    entityType: string,
    wrongText: string,
    correctText: string,
    supplierId?: string,
  ) {
    const existing = await this.prisma.ocrCorrectionRule.findFirst({
      where: { tenantId, entityType, wrongText, supplierId: supplierId || null },
    });

    if (existing) {
      await this.prisma.ocrCorrectionRule.update({
        where: { id: existing.id },
        data: { occurrences: { increment: 1 } },
      });
    } else {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);
      await this.prisma.ocrCorrectionRule.create({
        data: {
          tenantId,
          entityType,
          wrongText,
          correctText,
          supplierId: supplierId || null,
          expiresAt,
        },
      });
    }
  }

  // ─── Suppliers CRUD ───────────────────────────────────────────────────────

  async getSuppliers(tenantId: string) {
    if (!tenantId) return [];
    return this.prisma.ocrSupplier.findMany({
      where: { tenantId },
      include: { aliases: true, _count: { select: { invoices: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSupplier(tenantId: string, dto: CreateOcrSupplierDto) {
    return this.prisma.ocrSupplier.create({
      data: { tenantId, ...dto },
    });
  }

  async updateSupplier(tenantId: string, id: string, dto: Partial<CreateOcrSupplierDto>) {
    return this.prisma.ocrSupplier.update({
      where: { id, tenantId },
      data: dto,
    });
  }

  async deleteSupplier(tenantId: string, id: string) {
    return this.prisma.ocrSupplier.delete({ where: { id, tenantId } });
  }

  // ─── Items CRUD ───────────────────────────────────────────────────────────

  async getItems(tenantId: string) {
    if (!tenantId) return [];
    return this.prisma.ocrItem.findMany({
      where: { tenantId },
      include: { aliases: true, _count: { select: { priceHistory: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createItem(tenantId: string, dto: CreateOcrItemDto) {
    return this.prisma.ocrItem.create({
      data: { tenantId, ...dto },
    });
  }

  async updateItem(tenantId: string, id: string, dto: Partial<CreateOcrItemDto>) {
    return this.prisma.ocrItem.update({
      where: { id, tenantId },
      data: dto,
    });
  }

  async deleteItem(tenantId: string, id: string) {
    return this.prisma.ocrItem.delete({ where: { id, tenantId } });
  }

  async getItemPriceHistory(tenantId: string, itemId: string) {
    return this.prisma.ocrPriceHistory.findMany({
      where: { tenantId, itemId },
      include: { supplier: { select: { id: true, nameAr: true } } },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  // ─── Invoices CRUD ────────────────────────────────────────────────────────

  async getInvoices(tenantId: string) {
    if (!tenantId) return [];
    return this.prisma.ocrInvoice.findMany({
      where: { tenantId },
      include: {
        supplier: { select: { id: true, nameAr: true } },
        lines: { include: { item: { select: { id: true, nameAr: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveInvoice(tenantId: string, dto: SaveInvoiceDto) {
    const { lines, invoiceDate, totalAmount, vatAmount, ...invoiceData } = dto;

    const invoice = await this.prisma.ocrInvoice.create({
      data: {
        tenantId,
        supplierId: invoiceData.supplierId || null,
        invoiceNumber: invoiceData.invoiceNumber || null,
        imageUrl: invoiceData.imageUrl || null,
        rawExtraction: invoiceData.rawExtraction ? (invoiceData.rawExtraction as object) : undefined,
        notes: invoiceData.notes || null,
        totalAmount: totalAmount ? totalAmount : null,
        vatAmount: vatAmount ? vatAmount : null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        status: 'confirmed',
        lines: {
          create: lines.map((l) => ({
            rawName: l.rawName,
            itemId: l.itemId || null,
            quantity: l.quantity ? l.quantity : null,
            unitPrice: l.unitPrice ? l.unitPrice : null,
            totalPrice: l.totalPrice ? l.totalPrice : null,
            confidence: l.confidence ?? 0,
            matchStatus: l.matchStatus || 'pending',
          })),
        },
      },
      include: { lines: true },
    });

    // حفظ تاريخ الأسعار للأصناف المؤكدة
    if (dto.supplierId && invoiceDate) {
      for (const line of lines) {
        if (line.itemId && line.unitPrice && line.matchStatus === 'matched') {
          await this.prisma.ocrPriceHistory.create({
            data: {
              tenantId,
              itemId: line.itemId,
              supplierId: dto.supplierId,
              price: line.unitPrice,
              invoiceDate: new Date(invoiceDate),
              invoiceId: invoice.id,
            },
          });
        }
      }
    }

    return invoice;
  }

  async confirmInvoice(tenantId: string, id: string, status: string) {
    return this.prisma.ocrInvoice.update({
      where: { id, tenantId },
      data: { status },
    });
  }

  // ─── Price Alerts ─────────────────────────────────────────────────────────

  async getPriceAlerts(tenantId: string) {
    if (!tenantId) return [];
    const history = await this.prisma.ocrPriceHistory.findMany({
      where: { tenantId },
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
      lowestPrice: number;
      lowestSupplier: string;
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

      if (latestPrice > lowestPrice * 1.05) {
        alerts.push({
          itemId: latest.itemId,
          itemName: latest.item.nameAr,
          category: latest.item.category,
          latestPrice,
          latestSupplier: latest.supplier.nameAr,
          lowestPrice,
          lowestSupplier: lowestEntry.supplier.nameAr,
          averagePrice: Math.round(avgPrice * 100) / 100,
          priceIncreasePercent: Math.round(((latestPrice - lowestPrice) / lowestPrice) * 100),
        });
      }
    }

    return alerts.sort((a, b) => b.priceIncreasePercent - a.priceIncreasePercent);
  }

  // ─── Correction Rules ─────────────────────────────────────────────────────

  async getCorrectionRules(tenantId: string) {
    return this.prisma.ocrCorrectionRule.findMany({
      where: { tenantId },
      include: { supplier: { select: { id: true, nameAr: true } } },
      orderBy: { occurrences: 'desc' },
    });
  }

  async updateCorrectionRule(tenantId: string, id: string, status: string) {
    return this.prisma.ocrCorrectionRule.update({
      where: { id, tenantId },
      data: { status },
    });
  }

  // ─── Aliases ──────────────────────────────────────────────────────────────

  async addSupplierAlias(tenantId: string, supplierId: string, alias: string, language = 'ar') {
    return this.prisma.ocrSupplierAlias.create({
      data: { supplierId, alias, language, addedBy: 'support' },
    });
  }

  async addItemAlias(tenantId: string, itemId: string, alias: string, language = 'ar') {
    return this.prisma.ocrItemAlias.create({
      data: { itemId, alias, language, addedBy: 'support' },
    });
  }
}
