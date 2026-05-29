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
import { splitBilingualName, extractSizeFromName, findBestItemMatch } from './ocr-item-name-match.util';
import {
  buildGeminiUrl,
  getGeminiModelsToTry,
  OCR_EXTRACTION_PROMPT,
  OCR_EXTRACTION_RESPONSE_SCHEMA,
  supportsStructuredGeminiResponse,
  type GeminiExtractedInvoice,
} from './ocr-gemini-extract.constants';
import { validateOcrExtractionWithZod } from './ocr-extraction.schema';
import {
  applyMathValidation,
  buildQualityFlags,
  hasMeaningfulExtractionPayload,
  isActionableExtractionPayload,
  normalizeExtractedInvoicePayload,
  summarizeExtractionSignal,
  tryLocalJsonRepair,
  type GeminiExtractionWithMath,
} from './ocr-extraction-pipeline.util';
import {
  attachModelTelemetry,
  trimErrorText,
  type OcrModelAttemptStage,
  type OcrModelAttemptOutcome,
  type OcrModelAttemptTelemetry,
} from './ocr-model-telemetry.util';
import {
  learnItemAliasIfNeeded,
  learnSupplierAliasIfNeeded,
  type ItemMatchRow,
  type SupplierMatchRow,
} from './ocr-alias-learning.util';

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
        topP: 0.1,
        topK: 1,
        candidateCount: 1,
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
      generationConfig: { temperature: 0, topP: 0.1, topK: 1, candidateCount: 1, maxOutputTokens: 4096 },
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
      return parsed ? normalizeExtractedInvoicePayload(parsed) : null;
    } catch {
      return null;
    }
  }

  async extractInvoice(tenantId: string, companyId: string, dto: ExtractInvoiceDto) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new BadRequestException('Gemini API key not configured');

    const mimeType = dto.mimeType || 'image/jpeg';
    const modelsToTry = getGeminiModelsToTry();
    const extractionStartedAt = Date.now();
    const modelAttempts: OcrModelAttemptTelemetry[] = [];
    const primaryModel = modelsToTry[0]?.model;
    let bestEffortPayload: Record<string, unknown> | null = null;
    let bestEffortScore = -1;
    let bestEffortModel: string | undefined;
    let bestEffortVersion: string | undefined;
    const stageTotals = {
      modelRequestMs: 0,
      jsonValidationMs: 0,
      enrichmentMs: 0,
    };
    const registerBestEffort = (
      payload: Record<string, unknown>,
      score: number,
      model: string,
      version: string,
    ) => {
      if (score <= bestEffortScore) return;
      bestEffortPayload = payload;
      bestEffortScore = score;
      bestEffortModel = model;
      bestEffortVersion = version;
    };
    const attachPipelineTelemetry = (payload: Record<string, unknown>): Record<string, unknown> => {
      const failureStage =
        payload.pipelineFailureStage === 'model_request' || payload.pipelineFailureStage === 'json_validation'
          ? payload.pipelineFailureStage
          : null;
      const failureReason =
        typeof payload.pipelineFailureReason === 'string'
          ? payload.pipelineFailureReason
          : typeof payload.errorDetail === 'string'
            ? payload.errorDetail
            : undefined;
      const parseError = !!payload.parseError || failureStage === 'json_validation';
      const enrichError = typeof payload.enrichError === 'string' && payload.enrichError.trim().length > 0;
      return {
        ...payload,
        extractionStageTelemetry: {
          stages: {
            modelRequest: {
              durationMs: stageTotals.modelRequestMs,
              status: failureStage === 'model_request' ? 'failed' : 'success',
            },
            jsonValidation: {
              durationMs: stageTotals.jsonValidationMs,
              status: failureStage === 'json_validation' ? 'failed' : 'success',
            },
            enrichment: {
              durationMs: stageTotals.enrichmentMs,
              status: parseError ? 'skipped' : enrichError ? 'warning' : 'success',
            },
            readyForReview: {
              durationMs: 0,
              status: parseError ? 'skipped' : 'success',
            },
          },
          failedStage: failureStage || undefined,
          failureReason: trimErrorText(failureReason, 400),
        },
      };
    };

    // ── يُجرّب النماذج بالترتيب حتى ينجح أحدها ─────────────────────────
    for (const { model, version } of modelsToTry) {
      const url = `${buildGeminiUrl(model, version)}?key=${apiKey}`;
      const structuredOutput = supportsStructuredGeminiResponse(model);
      const requestBody = this.buildExtractionRequestBody(mimeType, dto.imageBase64, structuredOutput);
      const attemptStartedAt = Date.now();
      const attemptStageDurations: NonNullable<OcrModelAttemptTelemetry['stageDurationsMs']> = {};
      const pushAttempt = (patch: Partial<OcrModelAttemptTelemetry> & { outcome: OcrModelAttemptOutcome }) => {
        modelAttempts.push({
          model,
          version,
          structuredOutput,
          startedAt: new Date(attemptStartedAt).toISOString(),
          latencyMs: Date.now() - attemptStartedAt,
          parseStage: patch.parseStage || 'none',
          stageDurationsMs: {
            ...attemptStageDurations,
            ...(patch.stageDurationsMs || {}),
          },
          ...patch,
        });
      };

      let rawJson: GeminiRaw | null = null;
      try {
        const requestStageStartedAt = Date.now();
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        rawJson = await res.json().catch(() => null) as GeminiRaw | null;
        attemptStageDurations.requestMs = Math.max(1, Date.now() - requestStageStartedAt);
        stageTotals.modelRequestMs += attemptStageDurations.requestMs;

        if (!res.ok) {
          const errMsg = rawJson?.error?.message || res.statusText;
          const isUnavailable =
            res.status === 404 ||
            errMsg.toLowerCase().includes('not found') ||
            errMsg.toLowerCase().includes('not supported') ||
            errMsg.toLowerCase().includes('is not found for api version');
          const isRetryableHttp = res.status === 408 || res.status === 429 || res.status >= 500;

          if (isUnavailable) {
            pushAttempt({
              outcome: 'unavailable',
              httpStatus: res.status,
              error: trimErrorText(errMsg),
            });
            this.logger.warn(`Gemini model "${model}" unavailable → trying next in chain`);
            continue; // جرّب النموذج التالي
          }
          if (isRetryableHttp) {
            pushAttempt({
              outcome: 'http_error',
              httpStatus: res.status,
              error: trimErrorText(errMsg),
            });
            this.logger.warn(`Gemini transient HTTP error ${res.status} (${model}) → trying next model`);
            continue;
          }

          pushAttempt({
            outcome: 'http_error',
            httpStatus: res.status,
            error: trimErrorText(errMsg),
          });
          this.logger.error(`Gemini error ${res.status} (${model}): ${errMsg}`);
          throw new BadRequestException(`فشل الاستخراج من Gemini: ${errMsg}`);
        }

        // ── نجح الطلب ────────────────────────────────────────────────────
        const candidate = rawJson?.candidates?.[0];

        // فحص حظر المحتوى (safety / prompt feedback)
        const blockReason = rawJson?.promptFeedback?.blockReason || candidate?.finishReason;

        if (blockReason === 'SAFETY' || blockReason === 'RECITATION' || blockReason === 'OTHER') {
          pushAttempt({
            outcome: 'blocked',
            httpStatus: res.status,
            blockReason: trimErrorText(blockReason),
            finishReason: candidate?.finishReason,
          });
          this.logger.warn(`Gemini blocked (${model}): ${blockReason} → trying next model`);
          continue;
        }

        const text = this.extractTextFromGeminiResponse(rawJson);
        this.logger.log(`Gemini OK (${model}) | finish=${candidate?.finishReason} | textLen=${text.length}`);

        if (!text) {
          pushAttempt({
            outcome: 'empty',
            httpStatus: res.status,
            finishReason: candidate?.finishReason,
          });
          this.logger.warn(`Gemini returned empty text (${model}) → trying next model`);
          continue;
        }

        const parseAndValidateStartedAt = Date.now();
        const markParseAndValidateDone = () => {
          if (attemptStageDurations.parseAndValidateMs != null) return;
          attemptStageDurations.parseAndValidateMs = Math.max(1, Date.now() - parseAndValidateStartedAt);
          stageTotals.jsonValidationMs += attemptStageDurations.parseAndValidateMs;
        };
        let parseStage: OcrModelAttemptStage = 'none';
        const directParseStartedAt = Date.now();
        let extracted = extractJsonFromOcrLlmText<GeminiExtractedInvoice>(text);
        attemptStageDurations.directParseMs = Math.max(1, Date.now() - directParseStartedAt);
        if (extracted) parseStage = 'direct';
        if (!extracted) {
          const localRepairStartedAt = Date.now();
          extracted = tryLocalJsonRepair(text);
          attemptStageDurations.localRepairMs = Math.max(1, Date.now() - localRepairStartedAt);
          if (extracted) parseStage = 'local_repair';
        }
        if (!extracted) {
          const aiRepairStartedAt = Date.now();
          extracted = await this.tryRecoverJsonFromRawText(apiKey, model, version, text);
          attemptStageDurations.aiRepairMs = Math.max(1, Date.now() - aiRepairStartedAt);
          if (extracted) parseStage = 'ai_repair';
        }
        if (!extracted) {
          markParseAndValidateDone();
          this.logger.error(`Gemini parse failed (${model}). textLen=${text.length}`);
          pushAttempt({
            outcome: 'parse_failed',
            parseStage,
            httpStatus: res.status,
            finishReason: candidate?.finishReason,
            error: 'json_parse_failed',
          });
          const payload = {
            parseError: true,
            usedModel: model,
            usedModelVersion: version,
            rawText: text.substring(0, 400),
            errorDetail: 'JSON parse failed — Gemini returned text but no valid JSON found',
            pipelineFailureStage: 'json_validation',
            pipelineFailureReason: 'JSON parse failed — Gemini returned text but no valid JSON found',
            qualityFlags: ['json_parse_failed'],
            qualityStatus: 'needs_review',
            supplier: null, supplierMatch: null,
            vatNumber: null, invoiceNumber: null,
            invoiceDate: null, totalAmount: null,
            vatAmount: null, items: [],
          };
          registerBestEffort(payload, 4, model, version);
          continue;
        }

        const normalizedExtraction = normalizeExtractedInvoicePayload(extracted);
        this.logger.log(`Gemini extracted OK (${model}): supplier=${normalizedExtraction.supplier?.name} items=${normalizedExtraction.items?.length}`);

        const zodStartedAt = Date.now();
        const zodValidation = validateOcrExtractionWithZod(normalizedExtraction);
        attemptStageDurations.zodValidateMs = Math.max(1, Date.now() - zodStartedAt);
        if (!zodValidation.success) {
          markParseAndValidateDone();
          this.logger.warn(`OCR schema validation failed (${model}): ${zodValidation.issues.join(' | ')}`);
          pushAttempt({
            outcome: 'schema_failed',
            parseStage,
            httpStatus: res.status,
            finishReason: candidate?.finishReason,
            error: trimErrorText(zodValidation.issues.join(' | ')),
          });
          const payload = {
            parseError: true,
            usedModel: model,
            usedModelVersion: version,
            rawText: text.substring(0, 400),
            errorDetail: 'Schema validation failed for OCR extraction payload',
            pipelineFailureStage: 'json_validation',
            pipelineFailureReason: 'Schema validation failed for OCR extraction payload',
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
          registerBestEffort(payload, 10 + summarizeExtractionSignal(normalizedExtraction).completenessScore, model, version);
          continue;
        }

        const signalChecksStartedAt = Date.now();
        if (!hasMeaningfulExtractionPayload(zodValidation.data)) {
          attemptStageDurations.signalChecksMs = Math.max(1, Date.now() - signalChecksStartedAt);
          markParseAndValidateDone();
          pushAttempt({
            outcome: 'empty',
            parseStage,
            httpStatus: res.status,
            finishReason: candidate?.finishReason,
            error: 'no_signal_extracted',
          });
          this.logger.warn(`Gemini returned low-signal extraction (${model}) → trying next model`);
          continue;
        }

        if (!isActionableExtractionPayload(zodValidation.data)) {
          attemptStageDurations.signalChecksMs = Math.max(1, Date.now() - signalChecksStartedAt);
          const mathStartedAt = Date.now();
          const mathValidatedExtraction = applyMathValidation(zodValidation.data);
          attemptStageDurations.mathValidationMs = Math.max(1, Date.now() - mathStartedAt);
          markParseAndValidateDone();
          const qualityFlags = Array.from(new Set([
            ...buildQualityFlags(mathValidatedExtraction),
            'insufficient_actionable_fields',
          ]));
          pushAttempt({
            outcome: 'empty',
            parseStage,
            httpStatus: res.status,
            finishReason: candidate?.finishReason,
            error: 'insufficient_actionable_fields',
          });
          registerBestEffort({
            parseError: true,
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
            lineTaxMode: mathValidatedExtraction.lineTaxMode,
            pipelineFailureStage: 'json_validation',
            pipelineFailureReason: 'OCR extraction returned insufficient actionable fields',
            qualityFlags,
            qualityStatus: 'failed',
            errorDetail: 'OCR extraction returned insufficient actionable fields',
          }, 15 + summarizeExtractionSignal(zodValidation.data).completenessScore, model, version);
          this.logger.warn(`Gemini extraction not actionable (${model}) → trying next model`);
          continue;
        }

        attemptStageDurations.signalChecksMs = Math.max(1, Date.now() - signalChecksStartedAt);
        const mathStartedAt = Date.now();
        const mathValidatedExtraction = applyMathValidation(zodValidation.data);
        attemptStageDurations.mathValidationMs = Math.max(1, Date.now() - mathStartedAt);
        markParseAndValidateDone();

        const enrichStartedAt = Date.now();
        // enrichExtraction محمي بـ try/catch — لا يُفسد النتيجة
        try {
          const enriched = await this.enrichExtraction(tenantId, companyId, mathValidatedExtraction);
          attemptStageDurations.enrichMs = Math.max(1, Date.now() - enrichStartedAt);
          stageTotals.enrichmentMs += attemptStageDurations.enrichMs;
          pushAttempt({
            outcome: 'success',
            parseStage,
            httpStatus: res.status,
            finishReason: candidate?.finishReason,
          });
          return attachModelTelemetry(attachPipelineTelemetry(enriched as Record<string, unknown>), {
            attempts: modelAttempts,
            usedModel: model,
            usedModelVersion: version,
            extractionStartedAt,
            primaryModel,
          });
        } catch (enrichErr) {
          attemptStageDurations.enrichMs = Math.max(1, Date.now() - enrichStartedAt);
          stageTotals.enrichmentMs += attemptStageDurations.enrichMs;
          this.logger.error(`enrichExtraction failed: ${(enrichErr as Error).message}. Returning raw extraction.`);
          pushAttempt({
            outcome: 'success',
            parseStage,
            httpStatus: res.status,
            finishReason: candidate?.finishReason,
          });
          const qualityFlags = buildQualityFlags(mathValidatedExtraction, { enrichError: true });
          const payload = {
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
            lineTaxMode: mathValidatedExtraction.lineTaxMode,
            qualityFlags,
            qualityStatus: qualityFlags.includes('validated') ? 'validated' : 'needs_review',
            enrichError: (enrichErr as Error).message,
          };
          return attachModelTelemetry(attachPipelineTelemetry(payload), {
            attempts: modelAttempts,
            usedModel: model,
            usedModelVersion: version,
            extractionStartedAt,
            primaryModel,
          });
        }

      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        if (!attemptStageDurations.requestMs) {
          attemptStageDurations.requestMs = Math.max(1, Date.now() - attemptStartedAt);
          stageTotals.modelRequestMs += attemptStageDurations.requestMs;
        }
        pushAttempt({
          outcome: 'runtime_error',
          error: trimErrorText(err),
        });
        this.logger.error(`Gemini network/runtime error (${model}): ${(err as Error).message} ${(err as Error).stack}`);
        continue;
      }
    }

    if (bestEffortPayload) {
      return attachModelTelemetry(attachPipelineTelemetry(bestEffortPayload), {
        attempts: modelAttempts,
        usedModel: bestEffortModel,
        usedModelVersion: bestEffortVersion,
        extractionStartedAt,
        primaryModel,
      });
    }

    const lastOutcomes = modelAttempts
      .map((a) => `${a.model}:${a.outcome}`)
      .slice(-4)
      .join(', ');
    throw new BadRequestException(
      `لا يوجد نموذج Gemini متاح أو صالح للاستخراج. ${lastOutcomes ? `آخر المحاولات: ${lastOutcomes}` : ''}`.trim(),
    );
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

      await learnSupplierAliasIfNeeded(
        this.prisma,
        this.logger,
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
        const rawItemNameAr = item?.nameAr?.toString().trim() || undefined;
        const hasArabicRawName = !!rawItemNameAr && /[\u0600-\u06FF]/.test(rawItemNameAr);
        let resolvedNameAr = hasArabicRawName ? rawItemNameAr : splitNameAr;
        if (bestResult) {
          let status = classifyConfidence(bestResult.score);
          if (status === 'auto' && bestResult.autoEligible === false) {
            status = 'review';
          }
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

        await learnItemAliasIfNeeded(
          this.prisma,
          this.logger,
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

    const qualityFlags = buildQualityFlags({
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
      lineTaxMode: extracted.lineTaxMode,
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
