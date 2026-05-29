/**
 * استخراج Gemini + إثراء المطابقة وتسجيل الاستخراج/قواعد التصحيح.
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getGeminiApiKey } from '../config/gemini.config';
import { normalize } from './ocr-normalize.util';
import { findBestMatch, classifyConfidence } from './ocr-match.util';
import { ExtractInvoiceDto } from './dto/extract-invoice.dto';
import { extractJsonFromOcrLlmText } from '../common/utils/ocr-llm-json.util';
import { validateItemMath, validateInvoiceTotals } from './ocr-invoice-math-validate.util';
import { splitBilingualName, extractSizeFromName, findBestItemMatch } from './ocr-item-name-match.util';
import {
  buildGeminiUrl,
  getGeminiModelsToTry,
  OCR_EXTRACTION_PROMPT,
  OCR_EXTRACTION_RESPONSE_SCHEMA,
  supportsStructuredGeminiResponse,
  type GeminiExtractedInvoice,
} from './ocr-gemini-extract.constants';

type GeminiRaw = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string; code?: number };
  promptFeedback?: { blockReason?: string };
};

@Injectable()
export class OcrExtractionService {
  private readonly logger = new Logger(OcrExtractionService.name);

  constructor(private readonly prisma: PrismaService) {}

  private buildExtractionRequestBody(
    mimeType: string,
    imageBase64: string,
    structuredOutput: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      contents: [{
        parts: [
          { text: OCR_EXTRACTION_PROMPT },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: {
        temperature: 0,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
      // تعطيل كل فلاتر السلامة — الفواتير لا تحتوي محتوى ضار
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };
    if (structuredOutput) {
      (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
      (body.generationConfig as Record<string, unknown>).responseSchema = OCR_EXTRACTION_RESPONSE_SCHEMA;
    }
    return body;
  }

  private buildJsonRepairRequestBody(rawText: string, structuredOutput: boolean): Record<string, unknown> {
    const repairPrompt = `You are a strict JSON repair assistant for OCR extraction.
Convert the noisy response below into valid JSON that matches the target invoice schema exactly.
Never add markdown. Never invent values. Use null when value is not present in the source text.

NOISY_SOURCE_TEXT:
${rawText.slice(0, 12000)}`;

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: repairPrompt }] }],
      generationConfig: { temperature: 0, topP: 0.9, maxOutputTokens: 4096 },
    };
    if (structuredOutput) {
      (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
      (body.generationConfig as Record<string, unknown>).responseSchema = OCR_EXTRACTION_RESPONSE_SCHEMA;
    }
    return body;
  }

  private extractTextFromGeminiResponse(rawJson: GeminiRaw | null): string {
    const candidate = rawJson?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    return parts.map((p) => p.text || '').join('\n').trim();
  }

  private parseNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return undefined;
    const cleaned = value.trim().replace(/,/g, '');
    if (!cleaned) return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }

  private parseConfidence(value: unknown): number | undefined {
    const n = this.parseNumber(value);
    if (n == null) return undefined;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  private normalizeDigits(value: unknown): string | undefined {
    if (value == null) return undefined;
    const raw = String(value).trim();
    if (!raw) return undefined;
    const western = raw
      .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
      .replace(/[^0-9]/g, '');
    return western || undefined;
  }

  private normalizeYmd(value: unknown): string | undefined {
    if (value == null) return undefined;
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return undefined;
  }

  private normalizeExtractedInvoice(extracted: GeminiExtractedInvoice): GeminiExtractedInvoice {
    const supplierName = extracted?.supplier?.name?.trim() || undefined;
    const supplierConfidence = this.parseConfidence(extracted?.supplier?.confidence);
    const vatValue = this.normalizeDigits(extracted?.vatNumber?.value);
    const vatConfidence = this.parseConfidence(extracted?.vatNumber?.confidence);
    const invoiceNumber = extracted?.invoiceNumber?.value?.toString().trim() || undefined;
    const invoiceNumberConfidence = this.parseConfidence(extracted?.invoiceNumber?.confidence);
    const invoiceDate = this.normalizeYmd(extracted?.invoiceDate?.value);
    const invoiceDateConfidence = this.parseConfidence(extracted?.invoiceDate?.confidence);
    const subtotalValue = this.parseNumber(extracted?.subtotalAmount?.value);
    const subtotalConfidence = this.parseConfidence(extracted?.subtotalAmount?.confidence);
    const totalValue = this.parseNumber(extracted?.totalAmount?.value);
    const totalConfidence = this.parseConfidence(extracted?.totalAmount?.confidence);
    const vatAmountValue = this.parseNumber(extracted?.vatAmount?.value);
    const vatAmountConfidence = this.parseConfidence(extracted?.vatAmount?.confidence);

    const items = Array.isArray(extracted?.items)
      ? extracted.items.map((item) => {
        const name = item?.name?.toString().trim() || undefined;
        const quantity = this.parseNumber(item?.quantity);
        const unitPrice = this.parseNumber(item?.unitPrice);
        const totalPrice = this.parseNumber(item?.totalPrice);
        const confidence = this.parseConfidence(item?.confidence);
        return {
          ...(name ? { name } : {}),
          ...(quantity != null ? { quantity } : {}),
          ...(unitPrice != null ? { unitPrice } : {}),
          ...(totalPrice != null ? { totalPrice } : {}),
          ...(confidence != null ? { confidence } : {}),
        };
      }).filter((item) => Object.keys(item).length > 0)
      : [];

    return {
      ...(supplierName || supplierConfidence != null
        ? {
          supplier: {
            ...(supplierName ? { name: supplierName } : {}),
            ...(supplierConfidence != null ? { confidence: supplierConfidence } : {}),
          },
        }
        : {}),
      ...(vatValue || vatConfidence != null
        ? {
          vatNumber: {
            ...(vatValue ? { value: vatValue } : {}),
            ...(vatConfidence != null ? { confidence: vatConfidence } : {}),
          },
        }
        : {}),
      ...(invoiceNumber || invoiceNumberConfidence != null
        ? {
          invoiceNumber: {
            ...(invoiceNumber ? { value: invoiceNumber } : {}),
            ...(invoiceNumberConfidence != null ? { confidence: invoiceNumberConfidence } : {}),
          },
        }
        : {}),
      ...(invoiceDate || invoiceDateConfidence != null
        ? {
          invoiceDate: {
            ...(invoiceDate ? { value: invoiceDate } : {}),
            ...(invoiceDateConfidence != null ? { confidence: invoiceDateConfidence } : {}),
          },
        }
        : {}),
      ...(subtotalValue != null || subtotalConfidence != null
        ? {
          subtotalAmount: {
            ...(subtotalValue != null ? { value: subtotalValue } : {}),
            ...(subtotalConfidence != null ? { confidence: subtotalConfidence } : {}),
          },
        }
        : {}),
      ...(totalValue != null || totalConfidence != null
        ? {
          totalAmount: {
            ...(totalValue != null ? { value: totalValue } : {}),
            ...(totalConfidence != null ? { confidence: totalConfidence } : {}),
          },
        }
        : {}),
      ...(vatAmountValue != null || vatAmountConfidence != null
        ? {
          vatAmount: {
            ...(vatAmountValue != null ? { value: vatAmountValue } : {}),
            ...(vatAmountConfidence != null ? { confidence: vatAmountConfidence } : {}),
          },
        }
        : {}),
      items,
    };
  }

  private async tryRecoverJsonFromRawText(
    apiKey: string,
    model: string,
    version: string,
    rawText: string,
  ): Promise<GeminiExtractedInvoice | null> {
    if (!rawText.trim()) return null;
    try {
      const url = `${buildGeminiUrl(model, version)}?key=${apiKey}`;
      const structuredOutput = supportsStructuredGeminiResponse(model);
      const body = this.buildJsonRepairRequestBody(rawText, structuredOutput);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const rawJson = await res.json().catch(() => null) as GeminiRaw | null;
      const repairedText = this.extractTextFromGeminiResponse(rawJson);
      if (!repairedText) return null;
      const parsed = extractJsonFromOcrLlmText<GeminiExtractedInvoice>(repairedText);
      return parsed ? this.normalizeExtractedInvoice(parsed) : null;
    } catch {
      return null;
    }
  }

  async extractInvoice(tenantId: string, companyId: string, dto: ExtractInvoiceDto) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new BadRequestException('Gemini API key not configured');

    const mimeType = dto.mimeType || 'image/jpeg';
    const modelsToTry = getGeminiModelsToTry();

    // ── يُجرّب النماذج بالترتيب حتى ينجح أحدها ─────────────────────────
    for (const { model, version } of modelsToTry) {
      const url = `${buildGeminiUrl(model, version)}?key=${apiKey}`;
      const structuredOutput = supportsStructuredGeminiResponse(model);
      const requestBody = this.buildExtractionRequestBody(mimeType, dto.imageBase64, structuredOutput);

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
        const blockReason = rawJson?.promptFeedback?.blockReason || candidate?.finishReason;

        if (blockReason === 'SAFETY' || blockReason === 'RECITATION' || blockReason === 'OTHER') {
          this.logger.warn(`Gemini blocked (${model}): ${blockReason} → trying next model`);
          continue;
        }

        const text = this.extractTextFromGeminiResponse(rawJson);
        this.logger.log(`Gemini OK (${model}) | finish=${candidate?.finishReason} | textLen=${text.length}`);

        if (!text) {
          this.logger.warn(`Gemini returned empty text (${model}) → trying next model`);
          continue;
        }

        let extracted = extractJsonFromOcrLlmText<GeminiExtractedInvoice>(text);
        if (!extracted) {
          extracted = await this.tryRecoverJsonFromRawText(apiKey, model, version, text);
        }
        if (!extracted) {
          this.logger.error(`Gemini parse failed (${model}). textLen=${text.length}`);
          return {
            parseError: true,
            usedModel: model,
            rawText: text.substring(0, 400),
            errorDetail: 'JSON parse failed — Gemini returned text but no valid JSON found',
            supplier: null, supplierMatch: null,
            vatNumber: null, invoiceNumber: null,
            invoiceDate: null, totalAmount: null,
            vatAmount: null, items: [],
          };
        }

        const normalizedExtraction = this.normalizeExtractedInvoice(extracted);
        this.logger.log(`Gemini extracted OK (${model}): supplier=${normalizedExtraction.supplier?.name} items=${normalizedExtraction.items?.length}`);

        // enrichExtraction محمي بـ try/catch — لا يُفسد النتيجة
        try {
          return await this.enrichExtraction(tenantId, companyId, normalizedExtraction);
        } catch (enrichErr) {
          this.logger.error(`enrichExtraction failed: ${(enrichErr as Error).message}. Returning raw extraction.`);
          return {
            supplier: normalizedExtraction.supplier,
            supplierMatch: null,
            vatNumber: normalizedExtraction.vatNumber,
            invoiceNumber: normalizedExtraction.invoiceNumber,
            invoiceDate: normalizedExtraction.invoiceDate,
            totalAmount: normalizedExtraction.totalAmount,
            vatAmount: normalizedExtraction.vatAmount,
            items: (normalizedExtraction.items || []).map((item) => ({ ...item, itemMatch: null })),
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

  private async enrichExtraction(tenantId: string, companyId: string, extracted: GeminiExtractedInvoice) {
    const correctionRules = await this.prisma.ocrCorrectionRule.findMany({
      where: { tenantId, companyId, status: 'confirmed', expiresAt: { gte: new Date() } },
    });

    const applyCorrections = (
      raw: string,
      entityType: 'supplier' | 'item',
      supplierId?: string | null,
    ): string => {
      const trimmed = raw.trim();
      if (!trimmed) return raw;
      const norm = normalize(trimmed);
      const matchingRules = correctionRules.filter(
        (r) =>
          r.entityType === entityType &&
          normalize(r.wrongText) === norm &&
          (!r.supplierId || (supplierId && r.supplierId === supplierId)),
      );
      if (!matchingRules.length) return raw;
      const supplierScoped = matchingRules.find((r) => !!r.supplierId);
      return (supplierScoped || matchingRules[0]).correctText || raw;
    };

    const suppliers = await this.prisma.ocrSupplier.findMany({
      where: { tenantId, companyId },
      include: { aliases: true },
    });

    const items = await this.prisma.ocrItem.findMany({
      where: { tenantId, companyId },
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
        const nameForMatch = applyCorrections(supplierName, 'supplier');
        const result = findBestMatch(
          nameForMatch,
          suppliers,
          (s) => s.nameAr,
          (s) => [
            ...s.aliases.map((a) => a.alias),
            ...(s.nameEn ? [s.nameEn] : []),
          ],
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
      await this.logExtraction(tenantId, companyId, 'supplier', supplierName, supplierMatch);
    }

    // مطابقة الأصناف — المطابقة على الاسم الأساسي بدون الحجم
    const matchedItems = await Promise.all(
      (extracted.items || []).map(async (item) => {
        if (!item.name) return { ...item, itemMatch: null };

        // 1. استخرج الحجم من الاسم الكامل (بعد قواعد التصحيح المؤكّدة)
        const itemNameForPipeline = applyCorrections(item.name, 'item', supplierMatch?.id);
        const { cleanName, size, sizeUnit } = extractSizeFromName(itemNameForPipeline);

        // 2. قسّم الاسم إلى عربي وإنجليزي (بدون الحجم)
        const { nameAr, nameEn } = splitBilingualName(cleanName);

        // أضف الحقول المُستخرجة للصنف
        const enrichedItem = { ...item, nameAr, nameEn, size, sizeUnit, cleanName };

        // استخدم nameAr أو nameEn أو الاسم المُنظَّف للمطابقة
        const matchName = nameAr || nameEn || cleanName;

        // البحث الذكي يقارن ضد الاسم العربي والإنجليزي المستخرجَين من أسماء DB أيضاً
        const bestResult = findBestItemMatch(matchName, items);

        let itemMatch: { id: string; nameAr: string; nameEn?: string | null; score: number; status: string; hasSizes: boolean } | null = null;
        if (bestResult) {
          const status = classifyConfidence(bestResult.score);
          if (status !== 'new') {
            itemMatch = {
              id: bestResult.item.id,
              nameAr: bestResult.item.nameAr,
              nameEn: bestResult.item.nameEn,
              hasSizes: bestResult.item.hasSizes,
              score: bestResult.score,
              status: status === 'auto' ? 'auto' : 'review',
            };
          }
        }

        // تسجيل بالاسم الأساسي (بدون الحجم)
        await this.logExtraction(tenantId, companyId, 'item', matchName, itemMatch, supplierMatch?.id);

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
              companyId,
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

    // تحقق من مجموع الأصناف مع مراعاة الضريبة
    const itemsSum = enrichedWithWarnings.reduce((s, i) => s + (i.totalPrice || 0), 0);
    const invoiceTotalValidation = validateInvoiceTotals(
      itemsSum,
      extracted.totalAmount?.value,
      extracted.vatAmount?.value,
      extracted.subtotalAmount?.value,
    );

    return {
      supplier: extracted.supplier,
      supplierMatch,
      vatNumber: extracted.vatNumber,
      invoiceNumber: extracted.invoiceNumber,
      invoiceDate: extracted.invoiceDate,
      subtotalAmount: extracted.subtotalAmount,
      totalAmount: extracted.totalAmount,
      vatAmount: extracted.vatAmount,
      items: enrichedWithWarnings,
      invoiceTotalWarning: invoiceTotalValidation.valid ? undefined : invoiceTotalValidation.warning,
      vatAdjusted: invoiceTotalValidation.vatAdjusted, // للـ frontend: يعلمه أن المقارنة أخذت الضريبة بعين الاعتبار
    };
  }

  private async logExtraction(
    tenantId: string,
    companyId: string,
    entityType: string,
    extractedText: string,
    resolved: { id: string; nameAr: string; score: number } | null,
    supplierId?: string,
  ) {
    const normText = normalize(extractedText);
    const existing = await this.prisma.ocrExtractionLog.findFirst({
      where: { tenantId, companyId, entityType, extractedText: normText, supplierId: supplierId || null },
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
        await this.upsertCorrectionRule(tenantId, companyId, entityType, normText, resolved.nameAr, supplierId);
      }
    } else {
      await this.prisma.ocrExtractionLog.create({
        data: {
          tenantId,
          companyId,
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
    companyId: string,
    entityType: string,
    wrongText: string,
    correctText: string,
    supplierId?: string,
  ) {
    const existing = await this.prisma.ocrCorrectionRule.findFirst({
      where: { tenantId, companyId, entityType, wrongText, supplierId: supplierId || null },
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
          companyId,
          entityType,
          wrongText,
          correctText,
          supplierId: supplierId || null,
          expiresAt,
        },
      });
    }
  }

}
