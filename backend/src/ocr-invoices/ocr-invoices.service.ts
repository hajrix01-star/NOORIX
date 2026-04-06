import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getGeminiApiKey, getGeminiModel } from '../config/gemini.config';
import { normalize } from './ocr-normalize.util';
import { findBestMatch, classifyConfidence } from './ocr-match.util';
import { ExtractInvoiceDto } from './dto/extract-invoice.dto';
import { CreateOcrSupplierDto } from './dto/create-ocr-supplier.dto';
import { CreateOcrItemDto } from './dto/create-ocr-item.dto';
import { SaveInvoiceDto } from './dto/save-invoice.dto';

// ─── Math Validation ─────────────────────────────────────────────────────────

interface MathValidationResult {
  valid: boolean;
  warning?: string;
  suggestedQuantity?: number;
  suggestedUnitPrice?: number;
}

function validateItemMath(
  quantity?: number,
  unitPrice?: number,
  totalPrice?: number,
): MathValidationResult {
  if (!quantity || !unitPrice || !totalPrice) return { valid: true };

  const computed = quantity * unitPrice;
  const tolerance = Math.max(computed, totalPrice) * 0.03; // 3% هامش

  if (Math.abs(computed - totalPrice) <= tolerance) return { valid: true };

  // totalPrice هو المرجع الأوثق — احسب البديل
  const inferredQty = totalPrice / unitPrice;
  const inferredPrice = totalPrice / quantity;

  // إذا كانت الكمية المستنتجة عدداً صحيحاً (أو قريباً منه) → اقترح تصحيحها
  if (inferredQty > 0 && Math.abs(inferredQty - Math.round(inferredQty)) < 0.05) {
    return {
      valid: false,
      warning: `${quantity} × ${unitPrice} = ${computed.toFixed(2)} ≠ ${totalPrice} — الكمية المحتملة: ${Math.round(inferredQty)}`,
      suggestedQuantity: Math.round(inferredQty),
    };
  }

  return {
    valid: false,
    warning: `${quantity} × ${unitPrice} = ${computed.toFixed(2)} ≠ ${totalPrice} — السعر المحتمل: ${inferredPrice.toFixed(2)}`,
    suggestedUnitPrice: Math.round(inferredPrice * 100) / 100,
  };
}

function validateInvoiceTotals(
  itemsTotal: number,
  invoiceTotal?: number,
): { valid: boolean; warning?: string } {
  if (!invoiceTotal || itemsTotal === 0) return { valid: true };
  const tolerance = invoiceTotal * 0.05; // 5%
  if (Math.abs(itemsTotal - invoiceTotal) <= tolerance) return { valid: true };
  return {
    valid: false,
    warning: `مجموع الأصناف ${itemsTotal.toFixed(2)} لا يتطابق مع إجمالي الفاتورة ${invoiceTotal}`,
  };
}

// ─── Name & Size Parsing Utilities ───────────────────────────────────────────

const SIZE_UNITS = ['kg', 'g', 'gr', 'gm', 'ml', 'l', 'ltr', 'liter', 'pcs', 'pc', 'كجم', 'كيلو', 'جرام', 'مل', 'لتر', 'حبة', 'علبة', 'كيس'];
const SIZE_REGEX = new RegExp(
  `(\\d+(?:[.,]\\d+)?)\\s*(${SIZE_UNITS.join('|')})\\.?(?:\\s|$|x|×)`,
  'gi',
);
const ARABIC_RANGE = /[\u0600-\u06FF]/;
const LATIN_RANGE  = /[A-Za-z]/;

/** يقسّم الاسم المختلط إلى جزء عربي وجزء إنجليزي */
function splitBilingualName(name: string): { nameAr: string | null; nameEn: string | null } {
  if (!name) return { nameAr: null, nameEn: null };
  const hasAr = ARABIC_RANGE.test(name);
  const hasEn = LATIN_RANGE.test(name);
  if (!hasAr && !hasEn) return { nameAr: name, nameEn: null };
  if (hasAr && !hasEn)  return { nameAr: name, nameEn: null };
  if (!hasAr && hasEn)  return { nameAr: null, nameEn: name };

  // اسم مختلط — استخرج كل كلمة بحسب لغتها
  const arTokens: string[] = [];
  const enTokens: string[] = [];
  name.split(/\s+/).forEach((token) => {
    if (ARABIC_RANGE.test(token)) arTokens.push(token);
    else if (LATIN_RANGE.test(token)) enTokens.push(token);
    else { arTokens.push(token); enTokens.push(token); }
  });
  return {
    nameAr: arTokens.length  ? arTokens.join(' ') : null,
    nameEn: enTokens.length  ? enTokens.join(' ') : null,
  };
}

/** يستخرج الحجم ووحدته من اسم الصنف ويُرجع الاسم مُنظَّفاً */
function extractSizeFromName(name: string): { cleanName: string; size: string | null; sizeUnit: string | null } {
  if (!name) return { cleanName: name, size: null, sizeUnit: null };
  SIZE_REGEX.lastIndex = 0;
  const match = SIZE_REGEX.exec(name);
  if (!match) return { cleanName: name.trim(), size: null, sizeUnit: null };
  const size = match[1].replace(',', '.');
  const sizeUnit = match[2].toLowerCase();
  const cleanName = name.replace(match[0], ' ').replace(/\s{2,}/g, ' ').trim();
  return { cleanName, size, sizeUnit };
}

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
  name?: string;       // الاسم الكامل كما في الفاتورة (Gemini يُرجع هذا فقط)
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  confidence?: number;
  // هذه الحقول تُضاف بعد الاستخراج في enrichExtraction (ليس من Gemini)
  nameAr?: string;
  nameEn?: string;
  size?: string;
  sizeUnit?: string;
  cleanName?: string;
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

const OCR_EXTRACTION_PROMPT = `You are an expert invoice data extraction system. Extract ALL data from this invoice image and return ONLY a raw JSON object.

OUTPUT FORMAT (return exactly this structure, no markdown, no explanation):
{"supplier":{"name":"seller company name","confidence":0.95},"vatNumber":{"value":"tax number or null","confidence":0.9},"invoiceNumber":{"value":"invoice number or null","confidence":0.95},"invoiceDate":{"value":"YYYY-MM-DD or null","confidence":0.95},"totalAmount":{"value":1500.00,"confidence":0.98},"vatAmount":{"value":195.65,"confidence":0.98},"items":[{"name":"full item name exactly as printed","quantity":5,"unitPrice":60.00,"totalPrice":300.00,"confidence":0.90}]}

CRITICAL MATH RULE — MUST FOLLOW:
- For every item: totalPrice MUST equal quantity × unitPrice (within 1%)
- If you see a conflict between these 3 values, use totalPrice as the truth (it is printed as a subtotal on the invoice)
- Then recalculate: if totalPrice=42 and unitPrice=14, then quantity=3 (not whatever else you see)
- NEVER return mathematically inconsistent values

QUANTITY NOTATION RULES:
- "12x1-L" or "12x1L" means quantity=12 items, each 1 liter in size — set quantity=12
- "6x500ml" means quantity=6, size=500ml
- Pack/carton counts like "24PCS" mean quantity=24
- Arabic fractions: "نصف" = 0.5, "ربع" = 0.25 (rare — verify against totalPrice)

GENERAL RULES:
- Return ONLY the JSON, starting with { and ending with }
- confidence is 0.0 to 1.0
- Use null for any field you cannot find or read clearly
- Keep item names exactly as they appear (Arabic, English, or mixed)
- Date format must be YYYY-MM-DD
- Amounts must be numbers only (no currency text, no commas)
- Extract ALL line items from the invoice, do not skip any
- After extracting, mentally verify: sum of all item totalPrices ≈ invoice totalAmount`;



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
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      // تعطيل كل فلاتر السلامة — الفواتير لا تحتوي محتوى ضار
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',         threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',        threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',  threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT',  threshold: 'BLOCK_NONE' },
      ],
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

        // فحص حظر المحتوى (safety / prompt feedback)
        const blockReason =
          (rawJson as { promptFeedback?: { blockReason?: string } })?.promptFeedback?.blockReason
          || candidate?.finishReason;

        if (blockReason === 'SAFETY' || blockReason === 'RECITATION' || blockReason === 'OTHER') {
          this.logger.warn(`Gemini blocked (${model}): ${blockReason} → trying next model`);
          continue;
        }

        const parts = candidate?.content?.parts || [];
        const text = parts.map((p) => p.text || '').join('\n').trim();

        this.logger.log(`Gemini OK (${model}) | finish=${candidate?.finishReason} | parts=${parts.length} | textLen=${text.length} | text[500]=${text.substring(0, 500)}`);

        if (!text) {
          this.logger.warn(`Gemini returned empty text (${model}) → trying next model`);
          continue;
        }

        const extracted = extractJson<GeminiExtractedInvoice>(text);
        if (!extracted) {
          this.logger.error(`Gemini parse failed (${model}). textLen=${text.length} text(1000)=${text.substring(0, 1000)}`);
          return {
            parseError: true,
            usedModel: model,
            rawText: text.substring(0, 800),
            errorDetail: 'JSON parse failed — Gemini returned text but no valid JSON found',
            supplier: null, supplierMatch: null,
            vatNumber: null, invoiceNumber: null,
            invoiceDate: null, totalAmount: null,
            vatAmount: null, items: [],
          };
        }

        this.logger.log(`Gemini extracted OK (${model}): supplier=${extracted.supplier?.name} items=${extracted.items?.length}`);

        // enrichExtraction محمي بـ try/catch — لا يُفسد النتيجة
        try {
          return await this.enrichExtraction(tenantId, extracted);
        } catch (enrichErr) {
          this.logger.error(`enrichExtraction failed: ${(enrichErr as Error).message}. Returning raw extraction.`);
          return {
            supplier: extracted.supplier,
            supplierMatch: null,
            vatNumber: extracted.vatNumber,
            invoiceNumber: extracted.invoiceNumber,
            invoiceDate: extracted.invoiceDate,
            totalAmount: extracted.totalAmount,
            vatAmount: extracted.vatAmount,
            items: (extracted.items || []).map((item) => ({ ...item, itemMatch: null })),
            enrichError: (enrichErr as Error).message,
          };
        }

      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        this.logger.error(`Gemini network/runtime error (${model}): ${(err as Error).message} ${(err as Error).stack}`);
        throw new BadRequestException(`خطأ في الاتصال بـ Gemini: ${(err as Error).message}`);
      }
    }

    throw new BadRequestException('لا يوجد نموذج Gemini متاح. تحقق من GEMINI_API_KEY.');
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

        // 1. استخرج الحجم من الاسم الكامل
        const { cleanName, size, sizeUnit } = extractSizeFromName(item.name);

        // 2. قسّم الاسم إلى عربي وإنجليزي (بدون الحجم)
        const { nameAr, nameEn } = splitBilingualName(cleanName);

        // أضف الحقول المُستخرجة للصنف
        const enrichedItem = { ...item, nameAr, nameEn, size, sizeUnit, cleanName };

        // استخدم nameAr أو nameEn أو الاسم المُنظَّف للمطابقة
        const matchName = nameAr || nameEn || cleanName;

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
        if (itemMatch && size) {
          await this.prisma.ocrItem.update({
            where: { id: itemMatch.id },
            data: { hasSizes: true },
          }).catch(() => { /* تجاهل خطأ التحديث */ });
        }

        return { ...enrichedItem, itemMatch };
      }),
    );

    // ── التحقق الرياضي + Price Intelligence ──────────────────────────────────

    // سعر التاريخ — جلب آخر 90 يوم لكل صنف متطابق
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const enrichedWithWarnings = await Promise.all(
      matchedItems.map(async (item) => {
        // 1. تحقق رياضي
        const mathResult = validateItemMath(item.quantity, item.unitPrice, item.totalPrice);

        // 2. Price Intelligence — فقط للأصناف المطابقة والمسعّرة
        let priceWarning: { avg: number; deviation: number; lastPrice: number } | null = null;
        if (item.itemMatch?.id && item.unitPrice && item.unitPrice > 0) {
          const history = await this.prisma.ocrPriceHistory.findMany({
            where: {
              tenantId,
              itemId: item.itemMatch.id,
              invoiceDate: { gte: ninetyDaysAgo },
            },
            orderBy: { invoiceDate: 'desc' },
            take: 10,
          });

          if (history.length >= 2) {
            const avg = history.reduce((s, h) => s + Number(h.price), 0) / history.length;
            const deviation = Math.abs(item.unitPrice - avg) / avg;
            if (deviation > 0.25) { // >25% انحراف
              priceWarning = {
                avg: Math.round(avg * 100) / 100,
                deviation: Math.round(deviation * 100),
                lastPrice: Number(history[0].price),
              };
            }
          }
        }

        return {
          ...item,
          mathWarning: mathResult.valid ? undefined : {
            message: mathResult.warning,
            suggestedQuantity: mathResult.suggestedQuantity,
            suggestedUnitPrice: mathResult.suggestedUnitPrice,
          },
          priceWarning: priceWarning ?? undefined,
        };
      }),
    );

    // تحقق من مجموع الأصناف مقارنةً بإجمالي الفاتورة
    const itemsSum = enrichedWithWarnings.reduce((s, i) => s + (i.totalPrice || 0), 0);
    const invoiceTotalValidation = validateInvoiceTotals(
      itemsSum,
      extracted.totalAmount?.value,
    );

    return {
      supplier: extracted.supplier,
      supplierMatch,
      vatNumber: extracted.vatNumber,
      invoiceNumber: extracted.invoiceNumber,
      invoiceDate: extracted.invoiceDate,
      totalAmount: extracted.totalAmount,
      vatAmount: extracted.vatAmount,
      items: enrichedWithWarnings,
      invoiceTotalWarning: invoiceTotalValidation.valid ? undefined : invoiceTotalValidation.warning,
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
