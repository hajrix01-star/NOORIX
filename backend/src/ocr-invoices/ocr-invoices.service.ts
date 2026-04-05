import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getGeminiApiKey, getGeminiModel } from '../config/gemini.config';
import { normalize } from './ocr-normalize.util';
import { findBestMatch, classifyConfidence } from './ocr-match.util';
import { ExtractInvoiceDto } from './dto/extract-invoice.dto';
import { CreateOcrSupplierDto } from './dto/create-ocr-supplier.dto';
import { CreateOcrItemDto } from './dto/create-ocr-item.dto';
import { SaveInvoiceDto } from './dto/save-invoice.dto';

// ─── Gemini Model Fallback Chain ─────────────────────────────────────────────
// إذا لم يكن النموذج المُعيّن متاحاً، يجرب النظام النماذج بالترتيب تلقائياً
const GEMINI_FALLBACK_CHAIN = [
  { model: 'gemini-2.0-flash',     version: 'v1beta' },
  { model: 'gemini-2.5-flash',     version: 'v1beta' },
  { model: 'gemini-2.0-flash-exp', version: 'v1beta' },
  { model: 'gemini-1.5-flash',     version: 'v1'     },
  { model: 'gemini-1.5-pro',       version: 'v1'     },
  { model: 'gemini-pro-vision',    version: 'v1beta' },
];

function buildGeminiUrl(model: string, version: string): string {
  return `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`;
}

/** يُرجع قائمة النماذج للمحاولة: النموذج المُعيّن أولاً ثم سلسلة الـ fallback */
function getGeminiModelsToTry(): Array<{ model: string; version: string }> {
  const configured = getGeminiModel();
  const version = /^gemini-1\.[05]/.test(configured) ? 'v1' : 'v1beta';
  const chain = GEMINI_FALLBACK_CHAIN.filter((m) => m.model !== configured);
  return [{ model: configured, version }, ...chain];
}

function extractJson<T = Record<string, unknown>>(text: string): T | null {
  const raw = (text || '').trim();
  if (!raw) return null;

  // 1. جرب البحث عن آخر كتلة JSON في النص (لأن gemini-2.5 يضع thinking أولاً)
  const allJsonBlocks: string[] = [];

  // استخرج من كتل markdown
  const mdMatches = raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/g);
  for (const m of mdMatches) allJsonBlocks.push(m[1].trim());

  // استخرج كل {} كبرى في النص
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '{') {
      let depth = 0, end = -1;
      for (let j = i; j < raw.length; j++) {
        if (raw[j] === '{') depth++;
        else if (raw[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
      }
      if (end !== -1) {
        allJsonBlocks.push(raw.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }
    i++;
  }

  // 2. جرّب كل كتلة — ابدأ من الأخيرة (آخر JSON هو الجواب في نماذج التفكير)
  for (const block of [...allJsonBlocks].reverse()) {
    try {
      const parsed = JSON.parse(block) as T;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch { /* جرب التالية */ }
  }

  return null;
}

interface GeminiExtractedItem {
  name?: string;       // الاسم الكامل كما في الفاتورة
  nameAr?: string;     // الجزء العربي فقط
  nameEn?: string;     // الجزء الإنجليزي فقط
  size?: string;       // الحجم كرقم فقط: "700" أو "2" أو "500"
  sizeUnit?: string;   // وحدة الحجم: "g" | "kg" | "ml" | "L" | "pcs" | "حبة"
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  confidence?: number;
}

interface GeminiExtractedInvoice {
  supplier?: { name?: string; confidence?: number };
  vatNumber?: { value?: string; confidence?: number };
  invoiceNumber?: { value?: string; confidence?: number };
  invoiceDate?: { value?: string; confidence?: number };
  totalAmount?: { value?: number; confidence?: number };
  vatAmount?: { value?: number; confidence?: number };
  items?: GeminiExtractedItem[];
}

const OCR_EXTRACTION_PROMPT = `Extract invoice data from this image and return ONLY a valid JSON object. No explanation, no markdown, no text before or after — just the raw JSON.

Required format:
{
  "supplier": {"name": "SUPPLIER NAME", "confidence": 0.95},
  "vatNumber": {"value": "TAX_NUMBER_15_DIGITS", "confidence": 0.9},
  "invoiceNumber": {"value": "INV_NUMBER", "confidence": 0.95},
  "invoiceDate": {"value": "YYYY-MM-DD", "confidence": 0.95},
  "totalAmount": {"value": 1500.00, "confidence": 0.98},
  "vatAmount": {"value": 195.65, "confidence": 0.98},
  "items": [
    {
      "name": "FULL ITEM NAME AS PRINTED (e.g. جبن مراعي 700g أو PEPSI CAN 330ML)",
      "nameAr": "ARABIC PART ONLY (e.g. جبن مراعي)",
      "nameEn": "ENGLISH PART ONLY (e.g. PEPSI CAN) or null if none",
      "size": "NUMERIC SIZE ONLY (e.g. 700 or 330 or 2) or null if no size",
      "sizeUnit": "UNIT ONLY: g or kg or ml or L or pcs or null",
      "quantity": 5,
      "unitPrice": 60.00,
      "totalPrice": 300.00,
      "confidence": 0.90
    }
  ]
}

Rules:
- confidence: 0.0 to 1.0
- null for missing values
- nameAr: Arabic text only, nameEn: English/Latin text only — split mixed names
- size: extract from item name if present (700g → size="700", sizeUnit="g")
- Date must be YYYY-MM-DD, amounts are numbers only
- Response must start with { and end with }`;



@Injectable()
export class OcrInvoicesService {
  private readonly logger = new Logger(OcrInvoicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Gemini Vision OCR ────────────────────────────────────────────────────

  async extractInvoice(tenantId: string, dto: ExtractInvoiceDto) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new BadRequestException('Gemini API key not configured');

    const mimeType = dto.mimeType || 'image/jpeg';
    const modelsToTry = getGeminiModelsToTry();

    const requestBody = {
      contents: [{
        parts: [
          { text: OCR_EXTRACTION_PROMPT },
          { inlineData: { mimeType, data: dto.imageBase64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    };

    type GeminiRaw = {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      error?: { message?: string; code?: number };
    };

    // ── يُجرّب النماذج بالترتيب حتى ينجح أحدها ─────────────────────────
    for (const { model, version } of modelsToTry) {
      const url = `${buildGeminiUrl(model, version)}?key=${apiKey}`;

      let rawJson: GeminiRaw | null = null;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        rawJson = await res.json().catch(() => null) as GeminiRaw | null;

        if (!res.ok) {
          const errMsg = rawJson?.error?.message || res.statusText;
          const isUnavailable =
            res.status === 404 ||
            errMsg.toLowerCase().includes('not found') ||
            errMsg.toLowerCase().includes('not supported') ||
            errMsg.toLowerCase().includes('is not found for api version');

          if (isUnavailable) {
            this.logger.warn(`Gemini model "${model}" unavailable → trying next in chain`);
            continue; // جرّب النموذج التالي
          }

          this.logger.error(`Gemini error ${res.status} (${model}): ${errMsg}`);
          throw new BadRequestException(`فشل الاستخراج من Gemini: ${errMsg}`);
        }

        // ── نجح الطلب ────────────────────────────────────────────────────
        const candidate = rawJson?.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const text = parts.map((p) => p.text || '').join('\n').trim();

        this.logger.log(`Gemini OK (${model}) | finish=${candidate?.finishReason} | parts=${parts.length} | text[300]=${text.substring(0, 300)}`);

        const extracted = extractJson<GeminiExtractedInvoice>(text);
        if (!extracted) {
          this.logger.error(`Gemini parse failed (${model}). text(800)=${text.substring(0, 800)}`);
          return {
            parseError: true,
            usedModel: model,
            rawText: text.substring(0, 500),
            supplier: null, supplierMatch: null,
            vatNumber: null, invoiceNumber: null,
            invoiceDate: null, totalAmount: null,
            vatAmount: null, items: [],
          };
        }

        this.logger.log(`Gemini extracted OK (${model}): supplier=${extracted.supplier?.name} items=${extracted.items?.length}`);
        return await this.enrichExtraction(tenantId, extracted);

      } catch (err) {
        // خطأ شبكي — لا نستمر في الـ fallback لأنه ليس مشكلة نموذج
        if (err instanceof BadRequestException) throw err;
        this.logger.error(`Gemini network error (${model}): ${(err as Error).message}`);
        throw new BadRequestException('خطأ في الاتصال بـ Gemini');
      }
    }

    // وصلنا هنا يعني كل النماذج فشلت
    throw new BadRequestException('لا يوجد نموذج Gemini متاح في هذا الحساب. تحقق من GEMINI_API_KEY أو أضف GEMINI_MODEL في .env');
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

    // مطابقة الأصناف — المطابقة على الاسم الأساسي بدون الحجم
    const matchedItems = await Promise.all(
      (extracted.items || []).map(async (item) => {
        if (!item.name) return { ...item, itemMatch: null };

        // استخدم nameAr أو nameEn أو name الكامل للمطابقة (بدون الحجم)
        const matchName = item.nameAr || item.nameEn || item.name;

        const result = findBestMatch(
          matchName,
          items,
          (i) => i.nameAr,
          (i) => [
            ...(i.nameEn ? [i.nameEn] : []),
            ...i.aliases.map((a) => a.alias),
          ],
        );

        let itemMatch: { id: string; nameAr: string; nameEn?: string | null; score: number; status: string; hasSizes: boolean } | null = null;
        if (result) {
          const status = classifyConfidence(result.score);
          if (status !== 'new') {
            const matched = result.item as { id: string; nameAr: string; nameEn?: string | null; hasSizes: boolean };
            itemMatch = {
              id: matched.id,
              nameAr: matched.nameAr,
              nameEn: matched.nameEn,
              hasSizes: matched.hasSizes,
              score: result.score,
              status: status === 'auto' ? 'auto' : 'review',
            };
          }
        }

        // تسجيل بالاسم الأساسي (بدون الحجم)
        await this.logExtraction(tenantId, 'item', matchName, itemMatch, supplierMatch?.id);

        // إذا كان الصنف له حجم — حدّث has_sizes في الكتالوج
        if (itemMatch && item.size) {
          await this.prisma.ocrItem.update({
            where: { id: itemMatch.id },
            data: { hasSizes: true },
          }).catch(() => { /* تجاهل خطأ التحديث */ });
        }

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
    const { lines, invoiceDate, totalAmount, vatAmount, supplierName, ...invoiceData } = dto;

    // ── 1. إنشاء المورد تلقائياً إذا لم يكن موجوداً ───────────────────────
    let supplierId = invoiceData.supplierId || null;
    if (!supplierId && supplierName?.trim()) {
      // تحقق أولاً إذا كان المورد موجوداً بنفس الاسم لتجنب التكرار
      const existing = await this.prisma.ocrSupplier.findFirst({
        where: { tenantId, nameAr: supplierName.trim() },
      });
      if (existing) {
        supplierId = existing.id;
      } else {
        const newSupplier = await this.prisma.ocrSupplier.create({
          data: { tenantId, nameAr: supplierName.trim() },
        });
        supplierId = newSupplier.id;
        this.logger.log(`Auto-created OCR supplier: ${supplierName} (${newSupplier.id})`);
      }
    }

    // ── 2. إنشاء الأصناف تلقائياً لكل سطر ليس له itemId ─────────────────
    const processedLines = await Promise.all(
      lines.map(async (line) => {
        let itemId = line.itemId || null;
        if (!itemId && line.rawName?.trim()) {
          const existing = await this.prisma.ocrItem.findFirst({
            where: { tenantId, nameAr: line.rawName.trim() },
          });
          if (existing) {
            itemId = existing.id;
          } else {
            const newItem = await this.prisma.ocrItem.create({
              data: { tenantId, nameAr: line.rawName.trim() },
            });
            itemId = newItem.id;
            this.logger.log(`Auto-created OCR item: ${line.rawName} (${newItem.id})`);
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
        supplierId,
        invoiceNumber: invoiceData.invoiceNumber || null,
        imageUrl: invoiceData.imageUrl || null,
        rawExtraction: invoiceData.rawExtraction ? (invoiceData.rawExtraction as object) : undefined,
        notes: invoiceData.notes || null,
        totalAmount: totalAmount ? totalAmount : null,
        vatAmount: vatAmount ? vatAmount : null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        status: 'confirmed',
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

    // ── 4. حفظ تاريخ الأسعار لكل صنف له مورد وسعر (مع الحجم للتمييز) ──
    if (supplierId && invoiceDate) {
      for (const line of processedLines) {
        if (line.itemId && line.unitPrice) {
          await this.prisma.ocrPriceHistory.create({
            data: {
              tenantId,
              itemId:      line.itemId,
              supplierId,
              price:       line.unitPrice,
              size:        (line as { size?: string }).size || null,
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
