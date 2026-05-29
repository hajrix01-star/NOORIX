/**
 * استخراج Gemini + إثراء المطابقة وتسجيل الاستخراج/قواعد التصحيح.
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
  type GeminiExtractedItem,
  type GeminiExtractedInvoice,
} from './ocr-gemini-extract.constants';
import {
  normalizeOcrDateToYmd,
  normalizeOcrDigits,
  normalizeOcrInvoiceNumber,
  parseOcrConfidence,
  parseOcrNumber,
} from './ocr-extraction-normalize.util';
import { validateOcrExtractionWithZod } from './ocr-extraction.schema';

type GeminiRaw = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string; code?: number };
  promptFeedback?: { blockReason?: string };
};

type ItemMathWarning = {
  message?: string;
  suggestedQuantity?: number;
  suggestedUnitPrice?: number;
};

type ItemPriceWarning = {
  avg: number;
  deviation: number;
  lastPrice: number;
};

type GeminiItemWithWarnings = GeminiExtractedItem & {
  mathWarning?: ItemMathWarning;
  priceWarning?: ItemPriceWarning;
  itemMatch?: { id: string; nameAr: string; nameEn?: string | null; score: number; status: string; hasSizes: boolean } | null;
};

type GeminiExtractionWithMath = Omit<GeminiExtractedInvoice, 'items'> & {
  items: GeminiItemWithWarnings[];
  invoiceTotalWarning?: string;
  vatAdjusted: boolean;
};

type SupplierMatchRow = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  aliases: Array<{ alias: string }>;
};

type ItemMatchRow = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  aliases: Array<{ alias: string }>;
};

@Injectable()
export class OcrExtractionService {
  private readonly logger = new Logger(OcrExtractionService.name);
  private readonly arabicScriptRe = /[\u0600-\u06FF]/;

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

  private tryParseJsonCandidate(candidate: string): GeminiExtractedInvoice | null {
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as GeminiExtractedInvoice;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      return null;
    }
    return null;
  }

  private tryLocalJsonRepair(rawText: string): GeminiExtractedInvoice | null {
    if (!rawText.trim()) return null;

    const noMarkdown = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const normalizedQuotes = noMarkdown
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, '\'')
      .replace(/\u00A0/g, ' ');
    const withoutTrailingCommas = normalizedQuotes.replace(/,\s*([}\]])/g, '$1');
    const quotedKeys = withoutTrailingCommas.replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":');
    const quotedValues = quotedKeys.replace(/:\s*'([^']*)'/g, (_, value: string) => {
      const escaped = value.replace(/"/g, '\\"');
      return `: "${escaped}"`;
    });

    const candidates = [
      normalizedQuotes,
      withoutTrailingCommas,
      quotedKeys,
      quotedValues,
    ];
    for (const candidate of candidates) {
      const direct = this.tryParseJsonCandidate(candidate);
      if (direct) return direct;
      const extracted = extractJsonFromOcrLlmText<GeminiExtractedInvoice>(candidate);
      if (extracted) return extracted;
    }
    return null;
  }

  private normalizeExtractedInvoice(extracted: GeminiExtractedInvoice): GeminiExtractedInvoice {
    const supplierName = extracted?.supplier?.name?.trim() || undefined;
    const supplierConfidence = parseOcrConfidence(extracted?.supplier?.confidence);
    const vatValue = normalizeOcrDigits(extracted?.vatNumber?.value);
    const vatConfidence = parseOcrConfidence(extracted?.vatNumber?.confidence);
    const invoiceNumber = normalizeOcrInvoiceNumber(extracted?.invoiceNumber?.value);
    const invoiceNumberConfidence = parseOcrConfidence(extracted?.invoiceNumber?.confidence);
    const invoiceDate = normalizeOcrDateToYmd(extracted?.invoiceDate?.value);
    const invoiceDateConfidence = parseOcrConfidence(extracted?.invoiceDate?.confidence);
    const subtotalValue = parseOcrNumber(extracted?.subtotalAmount?.value);
    const subtotalConfidence = parseOcrConfidence(extracted?.subtotalAmount?.confidence);
    const totalValue = parseOcrNumber(extracted?.totalAmount?.value);
    const totalConfidence = parseOcrConfidence(extracted?.totalAmount?.confidence);
    const vatAmountValue = parseOcrNumber(extracted?.vatAmount?.value);
    const vatAmountConfidence = parseOcrConfidence(extracted?.vatAmount?.confidence);

    const items = Array.isArray(extracted?.items)
      ? extracted.items
        .map((item): GeminiExtractedItem | null => {
          const name = item?.name?.toString().trim() || undefined;
          if (!name) return null;

          const quantity = parseOcrNumber(item?.quantity);
          const unitPrice = parseOcrNumber(item?.unitPrice);
          const totalPrice = parseOcrNumber(item?.totalPrice);
          const confidence = parseOcrConfidence(item?.confidence);

          const rawNameAr = item?.nameAr?.toString().trim() || undefined;
          const hasArabicInNameAr = !!rawNameAr && /[\u0600-\u06FF]/.test(rawNameAr);
          const nameAr = hasArabicInNameAr ? rawNameAr : undefined;
          const nameEn = item?.nameEn?.toString().trim() || undefined;
          const size = item?.size?.toString().trim() || undefined;
          const sizeUnit = item?.sizeUnit?.toString().trim() || undefined;
          const cleanName = item?.cleanName?.toString().trim() || undefined;

          return {
            name,
            ...(quantity != null ? { quantity } : {}),
            ...(unitPrice != null ? { unitPrice } : {}),
            ...(totalPrice != null ? { totalPrice } : {}),
            ...(confidence != null ? { confidence } : {}),
            ...(nameAr ? { nameAr } : {}),
            ...(nameEn ? { nameEn } : {}),
            ...(size ? { size } : {}),
            ...(sizeUnit ? { sizeUnit } : {}),
            ...(cleanName ? { cleanName } : {}),
          };
        })
        .filter((item): item is GeminiExtractedItem => !!item)
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

  private applyMathValidation(extracted: GeminiExtractedInvoice): GeminiExtractionWithMath {
    const items = (extracted.items || []).map((item) => {
      const mathResult = validateItemMath(item.quantity, item.unitPrice, item.totalPrice);
      return {
        ...item,
        mathWarning: mathResult.valid
          ? undefined
          : {
            message: mathResult.warning,
            suggestedQuantity: mathResult.suggestedQuantity,
            suggestedUnitPrice: mathResult.suggestedUnitPrice,
          },
      };
    });

    const itemsSum = items.reduce((s, i) => s + (i.totalPrice || 0), 0);
    const invoiceTotalValidation = validateInvoiceTotals(
      itemsSum,
      extracted.totalAmount?.value,
      extracted.vatAmount?.value,
      extracted.subtotalAmount?.value,
    );

    return {
      ...extracted,
      items,
      invoiceTotalWarning: invoiceTotalValidation.valid ? undefined : invoiceTotalValidation.warning,
      vatAdjusted: invoiceTotalValidation.vatAdjusted,
    };
  }

  private buildQualityFlags(
    extracted: GeminiExtractionWithMath,
    options?: { schemaIssues?: string[]; enrichError?: boolean },
  ): string[] {
    const flags = new Set<string>();

    if (options?.schemaIssues?.length) flags.add('schema_validation_warning');
    if (options?.enrichError) flags.add('matching_enrichment_failed');
    if (!extracted.totalAmount?.value) flags.add('missing_total_amount');
    if (!extracted.items.length) flags.add('missing_items');

    const confidenceValues = [
      extracted.supplier?.confidence,
      extracted.vatNumber?.confidence,
      extracted.invoiceNumber?.confidence,
      extracted.invoiceDate?.confidence,
      extracted.totalAmount?.confidence,
      extracted.vatAmount?.confidence,
    ].filter((v): v is number => typeof v === 'number');
    if (confidenceValues.some((v) => v < 0.7)) flags.add('low_confidence_header');
    if (extracted.items.some((i) => typeof i.confidence === 'number' && i.confidence < 0.7)) {
      flags.add('low_confidence_items');
    }
    if (extracted.items.some((i) => i.mathWarning?.message) || extracted.invoiceTotalWarning) {
      flags.add('math_validation_warning');
    }

    if (!flags.size) flags.add('validated');
    return Array.from(flags);
  }

  private detectAliasLanguage(text: string): 'ar' | 'en' {
    return this.arabicScriptRe.test(text) ? 'ar' : 'en';
  }

  private shouldSkipAliasLearning(
    rawAlias: string | undefined | null,
    canonical: string,
    altCanonical: string | null | undefined,
    existingAliases: Array<{ alias: string }>,
  ): string | null {
    const trimmed = rawAlias?.trim();
    if (!trimmed || trimmed.length < 3) return null;
    const normAlias = normalize(trimmed);
    if (!normAlias || normAlias.length < 2) return null;
    if (normalize(canonical) === normAlias) return null;
    if (altCanonical && normalize(altCanonical) === normAlias) return null;
    if (existingAliases.some((a) => normalize(a.alias) === normAlias)) return null;
    return trimmed;
  }

  private async learnSupplierAliasIfNeeded(
    suppliers: SupplierMatchRow[],
    supplierMatch: { id: string; score: number } | null,
    rawAlias: string | undefined,
    seenKeys: Set<string>,
  ): Promise<void> {
    if (!supplierMatch || supplierMatch.score < 0.9) return;
    const matched = suppliers.find((s) => s.id === supplierMatch.id);
    if (!matched) return;

    const candidate = this.shouldSkipAliasLearning(rawAlias, matched.nameAr, matched.nameEn, matched.aliases);
    if (!candidate) return;
    const normCandidate = normalize(candidate);
    const key = `${matched.id}:${normCandidate}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    await this.prisma.ocrSupplierAlias
      .create({
        data: {
          supplierId: matched.id,
          alias: candidate,
          language: this.detectAliasLanguage(candidate),
          addedBy: 'ocr-auto',
        },
      })
      .catch(() => {});
    matched.aliases.push({ alias: candidate });
    this.logger.log(`OCR learned supplier alias "${candidate}" -> ${matched.id}`);
  }

  private async learnItemAliasIfNeeded(
    items: ItemMatchRow[],
    itemMatch: { id: string; score: number } | null,
    rawAlias: string | undefined,
    seenKeys: Set<string>,
  ): Promise<void> {
    if (!itemMatch || itemMatch.score < 0.9) return;
    const matched = items.find((i) => i.id === itemMatch.id);
    if (!matched) return;

    const candidate = this.shouldSkipAliasLearning(rawAlias, matched.nameAr, matched.nameEn, matched.aliases);
    if (!candidate) return;
    const normCandidate = normalize(candidate);
    const key = `${matched.id}:${normCandidate}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    await this.prisma.ocrItemAlias
      .create({
        data: {
          itemId: matched.id,
          alias: candidate,
          language: this.detectAliasLanguage(candidate),
          addedBy: 'ocr-auto',
        },
      })
      .catch(() => {});
    matched.aliases.push({ alias: candidate });
    this.logger.log(`OCR learned item alias "${candidate}" -> ${matched.id}`);
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
          extracted = this.tryLocalJsonRepair(text);
        }
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
            qualityFlags: ['json_parse_failed'],
            qualityStatus: 'needs_review',
            supplier: null, supplierMatch: null,
            vatNumber: null, invoiceNumber: null,
            invoiceDate: null, totalAmount: null,
            vatAmount: null, items: [],
          };
        }

        const normalizedExtraction = this.normalizeExtractedInvoice(extracted);
        this.logger.log(`Gemini extracted OK (${model}): supplier=${normalizedExtraction.supplier?.name} items=${normalizedExtraction.items?.length}`);

        const zodValidation = validateOcrExtractionWithZod(normalizedExtraction);
        if (!zodValidation.success) {
          this.logger.warn(`OCR schema validation failed (${model}): ${zodValidation.issues.join(' | ')}`);
          return {
            parseError: true,
            usedModel: model,
            rawText: text.substring(0, 400),
            errorDetail: 'Schema validation failed for OCR extraction payload',
            schemaIssues: zodValidation.issues.slice(0, 10),
            qualityFlags: ['schema_validation_failed'],
            qualityStatus: 'failed',
            supplier: normalizedExtraction.supplier ?? null,
            supplierMatch: null,
            vatNumber: normalizedExtraction.vatNumber ?? null,
            invoiceNumber: normalizedExtraction.invoiceNumber ?? null,
            invoiceDate: normalizedExtraction.invoiceDate ?? null,
            subtotalAmount: normalizedExtraction.subtotalAmount ?? null,
            totalAmount: normalizedExtraction.totalAmount ?? null,
            vatAmount: normalizedExtraction.vatAmount ?? null,
            items: [],
          };
        }

        const mathValidatedExtraction = this.applyMathValidation(zodValidation.data);

        // enrichExtraction محمي بـ try/catch — لا يُفسد النتيجة
        try {
          return await this.enrichExtraction(tenantId, companyId, mathValidatedExtraction);
        } catch (enrichErr) {
          this.logger.error(`enrichExtraction failed: ${(enrichErr as Error).message}. Returning raw extraction.`);
          const qualityFlags = this.buildQualityFlags(mathValidatedExtraction, { enrichError: true });
          return {
            supplier: mathValidatedExtraction.supplier,
            supplierMatch: null,
            vatNumber: mathValidatedExtraction.vatNumber,
            invoiceNumber: mathValidatedExtraction.invoiceNumber,
            invoiceDate: mathValidatedExtraction.invoiceDate,
            subtotalAmount: mathValidatedExtraction.subtotalAmount,
            totalAmount: mathValidatedExtraction.totalAmount,
            vatAmount: mathValidatedExtraction.vatAmount,
            items: (mathValidatedExtraction.items || []).map((item) => ({ ...item, itemMatch: null })),
            invoiceTotalWarning: mathValidatedExtraction.invoiceTotalWarning,
            vatAdjusted: mathValidatedExtraction.vatAdjusted,
            qualityFlags,
            qualityStatus: qualityFlags.includes('validated') ? 'validated' : 'needs_review',
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

  private async enrichExtraction(tenantId: string, companyId: string, extracted: GeminiExtractionWithMath) {
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
    const learnedSupplierAliasKeys = new Set<string>();
    const learnedItemAliasKeys = new Set<string>();

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

      await this.learnSupplierAliasIfNeeded(
        suppliers,
        supplierMatch,
        supplierName,
        learnedSupplierAliasKeys,
      );

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
        const normalizedSize = size || undefined;
        const normalizedSizeUnit = sizeUnit || undefined;

        // 2. قسّم الاسم إلى عربي وإنجليزي (بدون الحجم)
        const { nameAr, nameEn } = splitBilingualName(cleanName);
        const splitNameAr = nameAr || undefined;
        const splitNameEn = nameEn || undefined;

        // أضف الحقول المُستخرجة للصنف
        const enrichedItem = {
          ...item,
          nameAr: splitNameAr,
          nameEn: splitNameEn,
          size: normalizedSize,
          sizeUnit: normalizedSizeUnit,
          cleanName,
        };

        // استخدم nameAr أو nameEn أو الاسم المُنظَّف للمطابقة
        const matchName = splitNameAr || splitNameEn || cleanName;

        // البحث الذكي يقارن ضد الاسم العربي والإنجليزي المستخرجَين من أسماء DB أيضاً
        const bestResult = findBestItemMatch(matchName, items);

        let itemMatch: { id: string; nameAr: string; nameEn?: string | null; score: number; status: string; hasSizes: boolean } | null = null;
        let resolvedNameAr = splitNameAr;
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
            // قاعدة صارمة: لا نملأ nameAr من اسم إنجليزي، إلا من كتالوج موثوق.
            if (!resolvedNameAr && bestResult.score >= 0.9 && bestResult.item.nameAr) {
              resolvedNameAr = bestResult.item.nameAr;
            }
          }
        }

        await this.learnItemAliasIfNeeded(
          items,
          itemMatch,
          cleanName || itemNameForPipeline,
          learnedItemAliasKeys,
        );

        // تسجيل بالاسم الأساسي (بدون الحجم)
        await this.logExtraction(tenantId, companyId, 'item', matchName, itemMatch, supplierMatch?.id);

        // إذا كان الصنف له حجم — حدّث has_sizes في الكتالوج
        if (itemMatch && normalizedSize) {
          await this.prisma.ocrItem.update({
            where: { id: itemMatch.id },
            data: { hasSizes: true },
          }).catch(() => { /* تجاهل خطأ التحديث */ });
        }

        return { ...enrichedItem, nameAr: resolvedNameAr || undefined, itemMatch };
      }),
    );

    // ── Price Intelligence (التحقق الرياضي تم قبل المطابقة) ──────────────────

    // سعر التاريخ — جلب آخر 90 يوم لكل صنف متطابق
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const enrichedWithWarnings = await Promise.all(
      matchedItems.map(async (item) => {
        // Price Intelligence — فقط للأصناف المطابقة والمسعّرة
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
          priceWarning: priceWarning ?? undefined,
        };
      }),
    );

    const qualityFlags = this.buildQualityFlags({
      ...extracted,
      items: enrichedWithWarnings,
    });

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
      invoiceTotalWarning: extracted.invoiceTotalWarning,
      vatAdjusted: extracted.vatAdjusted, // للـ frontend: يعلمه أن المقارنة أخذت الضريبة بعين الاعتبار
      qualityFlags,
      qualityStatus: qualityFlags.includes('validated') ? 'validated' : 'needs_review',
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
