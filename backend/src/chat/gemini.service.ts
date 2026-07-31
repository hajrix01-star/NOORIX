import { Injectable, Logger } from '@nestjs/common';
import { getGeminiApiKey, getGeminiIntentConfidenceMin } from '../config/gemini.config';
import { extractJson } from '../common/utils/extract-json.util';
import { getGeminiChatIntentRequestUrl, GEMINI_CHAT_INTENT_SYSTEM_PROMPT, GEMINI_INTENT_FIELD_SCHEMA_DESCRIPTION } from './gemini-chat-intent-prompts.util';
import { normalizeGeminiIntent, normalizeGeminiPeriod } from './gemini-normalize.util';
import { GeminiConcurrencyGate } from './gemini-concurrency.util';
import type { GeminiParseResult } from './gemini-types';
import {
  analyzeBankStatementPhase1WithGemini,
  analyzeBankStatementPhase2WithGemini,
  suggestBankStatementHeaderMetadataWithGemini,
} from './gemini-bank-statement-analysis.util';
import type { BankStatementHeaderMetadata, BankStatementPhase1Result } from './gemini-bank-statement-prompts.util';
import { buildDashboardInsightsPrompt } from './gemini-dashboard-insights-prompt.util';
import { buildGeneralAnswerPrompt } from './gemini-general-answer-prompt.util';
import {
  getGeminiCandidateText,
  type GeminiGenerateContentResponse,
} from './gemini-response.util';
import {
  buildCatalogTranslationPrompt,
  normalizeCatalogTranslations,
  type CatalogTranslationInput,
  type CatalogTranslationSuggestion,
  type RawCatalogTranslation,
} from './gemini-catalog-translation.util';

export type { GeminiIntent, GeminiPeriod, GeminiParseResult } from './gemini-types';
export { DASHBOARD_INSIGHTS_LLM_SYSTEM_PROMPT } from './gemini-dashboard-insights-prompt.util';

@Injectable()
export class GeminiService {
  private readonly apiKey: string | null;
  private readonly geminiGate = new GeminiConcurrencyGate();
  private readonly logger = new Logger(GeminiService.name);

  constructor() {
    this.apiKey = getGeminiApiKey();
  }

  /** Ù‡Ù„ Ø§Ù„Ø®Ø¯Ù…Ø© Ù…ØªØ§Ø­Ø© (Ù…ÙØªØ§Ø­ Ù…ÙˆØ¬ÙˆØ¯)ØŸ */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * ÙÙ‡Ù… Ø§Ù„Ù†ÙŠØ© Ù…Ù† Ø§Ù„Ø³Ø¤Ø§Ù„ Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù… Gemini
   * Ù„Ø§ ÙŠÙØ±Ø³Ù„ Ø£ÙŠ Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ø§Ù„ÙŠØ© â€” ÙÙ‚Ø· Ù†Øµ Ø§Ù„Ø³Ø¤Ø§Ù„
   */
  async parseIntent(query: string): Promise<GeminiParseResult | null> {
    if (!this.apiKey) return null;

    const trimmed = (query || '').trim();
    if (!trimmed || trimmed.length > 500) return null;

    return this.geminiGate.with(async () => {
    try {
      const response = await fetch(`${getGeminiChatIntentRequestUrl()}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${GEMINI_CHAT_INTENT_SYSTEM_PROMPT}\n\nØ§Ù„Ø³Ø¤Ø§Ù„: "${trimmed}"` }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 128,
            responseMimeType: 'application/json',
            responseJsonSchema: {
              type: 'object',
              properties: {
                intent: { type: 'string', description: GEMINI_INTENT_FIELD_SCHEMA_DESCRIPTION },
                period: { type: 'string', description: 'One of: today, yesterday, day_before_yesterday, this_week, last_week, this_month, last_month, year, or null' },
                confidence: {
                  type: 'number',
                  description:
                    'Your confidence in the chosen intent from 0 to 1. Use 0.85+ when the wording clearly matches one intent; 0.5 or below when ambiguous; if unsure between dashboard_insights and raw purchases/sales numbers, use lower confidence.',
                },
              },
              required: ['intent'],
            },
          },
        }),
      });

      if (!response.ok) {
        this.logger.warn(`parseIntent API error: ${response.status} ${await response.text()}`);
        return null;
      }

      const data: GeminiGenerateContentResponse = await response.json();
      const text = getGeminiCandidateText(data);
      if (!text) return null;

      const parsed = extractJson<{ intent?: string; period?: string | null; confidence?: number }>(text);
      if (!parsed) return null;
      const normalizedIntent = normalizeGeminiIntent(parsed?.intent);
      const period = normalizeGeminiPeriod(parsed?.period);

      const rawConf = parsed?.confidence;
      let modelConfidence: number | undefined;
      if (typeof rawConf === 'number' && Number.isFinite(rawConf)) {
        modelConfidence = Math.min(1, Math.max(0, rawConf));
      }

      const minConf = getGeminiIntentConfidenceMin();
      if (modelConfidence !== undefined && modelConfidence < minConf) {
        this.logger.debug(
          `parseIntent: low confidence ${modelConfidence} < ${minConf} for intent=${normalizedIntent} -> unknown`,
        );
        return {
          intent: 'unknown',
          period,
          rawQuery: trimmed,
          confidence: modelConfidence,
          confidenceRejected: true,
          rejectedModelIntent: normalizedIntent,
        };
      }

      return {
        intent: normalizedIntent,
        period,
        rawQuery: trimmed,
        ...(modelConfidence !== undefined ? { confidence: modelConfidence } : {}),
      };
    } catch (err) {
      this.logger.warn(`parseIntent: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
    });
  }

  /**
   * Ø´Ø±Ø­ JSON Ø§Ù„Ø±Ø¤Ù‰ ÙÙ‚Ø· â€” Ù„Ø§ Ø¬Ù„Ø¨ Ø¨ÙŠØ§Ù†Ø§Øª ÙˆÙ„Ø§ Ø­Ø³Ø§Ø¨Ø§ØªØ› Ø¹Ù†Ø¯ Ø§Ù„ÙØ´Ù„ ÙŠÙØ±Ø¬Ø¹ null
   */
  async explainDashboardInsights(
    userQuery: string,
    insightsPackage: Record<string, unknown>,
    opts: { prefersArabic: boolean },
  ): Promise<{ answerAr: string; answerEn: string } | null> {
    if (!this.apiKey) return null;
    const trimmed = (userQuery || '').trim();
    if (!trimmed || trimmed.length > 500) return null;

    return this.geminiGate.with(async () => {
      try {
        const response = await fetch(`${getGeminiChatIntentRequestUrl()}?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: buildDashboardInsightsPrompt({
                      prefersArabic: opts.prefersArabic,
                      insightsPackage,
                      userQuery: trimmed,
                    }),
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.15,
              maxOutputTokens: 512,
              responseMimeType: 'application/json',
              responseJsonSchema: {
                type: 'object',
                properties: {
                  answerAr: { type: 'string' },
                  answerEn: { type: 'string' },
                },
                required: ['answerAr', 'answerEn'],
              },
            },
          }),
        });

        if (!response.ok) return null;

        const data: GeminiGenerateContentResponse = await response.json();
        const text = getGeminiCandidateText(data);
        if (!text) return null;

        const parsed = extractJson<{ answerAr?: string; answerEn?: string }>(text);
        if (!parsed?.answerAr || !parsed?.answerEn) return null;

        return {
          answerAr: String(parsed.answerAr).trim(),
          answerEn: String(parsed.answerEn).trim(),
        };
      } catch (err) {
        this.logger.warn(`explainDashboardInsights: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
    });
  }

  /**
   * Ø¥Ø¬Ø§Ø¨Ø© Ø¹Ø§Ù…Ø© â€” Ù„Ù„Ø£Ø³Ø¦Ù„Ø© Ø®Ø§Ø±Ø¬ Ù†Ø·Ø§Ù‚ Ø§Ù„Ù†Ø¸Ø§Ù… (ØªØ­ÙŠØ§ØªØŒ Ø£Ø³Ø¦Ù„Ø© Ø¹Ø§Ù…Ø©)
   * Ù„Ù„ØªØ¬Ø±Ø¨Ø©: Ø¹Ù†Ø¯ ØªÙØ¹ÙŠÙ„ GEMINI_OPEN_MODE=true
   */
  async answerGeneral(query: string): Promise<{ answerAr: string; answerEn: string } | null> {
    if (!this.apiKey) return null;

    const trimmed = (query || '').trim();
    if (!trimmed || trimmed.length > 1200) return null;

    return this.geminiGate.with(async () => {
    try {
      const response = await fetch(`${getGeminiChatIntentRequestUrl()}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: buildGeneralAnswerPrompt(trimmed) }],
            },
          ],
          generationConfig: {
            temperature: 0.45,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
            responseJsonSchema: {
              type: 'object',
              properties: {
                answerAr: { type: 'string' },
                answerEn: { type: 'string' },
              },
              required: ['answerAr', 'answerEn'],
            },
          },
        }),
      });

      if (!response.ok) return null;

      const data: GeminiGenerateContentResponse = await response.json();
      const text = getGeminiCandidateText(data);
      if (!text) return null;

      const parsed = extractJson<{ answerAr?: string; answerEn?: string }>(text);
      if (!parsed?.answerAr) return null;

      return {
        answerAr: String(parsed.answerAr).slice(0, 500),
        answerEn: String(parsed.answerEn || parsed.answerAr).slice(0, 500),
      };
    } catch (err) {
      console.warn('[GeminiService] answerGeneral error:', err);
      return null;
    }
    });
  }

  async translateRestaurantCatalogItems(
    items: CatalogTranslationInput[],
  ): Promise<CatalogTranslationSuggestion[] | null> {
    if (!this.apiKey || !items.length || items.length > 50) return null;

    return this.geminiGate.with(async () => {
      try {
        const response = await fetch(`${getGeminiChatIntentRequestUrl()}?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildCatalogTranslationPrompt(items) }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
              responseJsonSchema: {
                type: 'object',
                properties: {
                  translations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        suggestedNameEn: { type: 'string' },
                        classification: {
                          type: 'string',
                          enum: ['ingredient', 'beverage', 'cleaning', 'packaging', 'equipment', 'brand', 'other'],
                        },
                        confidence: { type: 'number' },
                        needsReview: { type: 'boolean' },
                      },
                      required: ['id', 'suggestedNameEn', 'classification', 'confidence', 'needsReview'],
                    },
                  },
                },
                required: ['translations'],
              },
            },
          }),
        });
        if (!response.ok) return null;

        const data: GeminiGenerateContentResponse = await response.json();
        const text = getGeminiCandidateText(data);
        if (!text) return null;
        const parsed = extractJson<{ translations?: RawCatalogTranslation[] }>(text);
        return normalizeCatalogTranslations(parsed?.translations, items);
      } catch (error) {
        this.logger.warn(`Catalog translation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        return null;
      }
    });
  }

  /**
   * ØªØ­Ù„ÙŠÙ„ ÙƒØ´Ù Ø­Ø³Ø§Ø¨ â€” Ø®Ø·ÙˆØ© 1: Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ÙˆØµÙÙŠØ© ÙˆÙ†Ø·Ø§Ù‚ Ø§Ù„Ø¬Ø¯ÙˆÙ„
   *
   * âš ï¸ ØªØ­Ø°ÙŠØ± Ø£Ù…Ù†ÙŠ: ÙŠÙØ±Ø³ÙŽÙ„ Ø¥Ù„Ù‰ Gemini API Ø£ÙˆÙ„ 35 ØµÙØ§Ù‹ Ù…Ù† Ù…Ù„Ù Excel Ø§Ù„Ø®Ø§Ù….
   * Ù‚Ø¯ ØªØ­ØªÙˆÙŠ Ù‡Ø°Ù‡ Ø§Ù„ØµÙÙˆÙ Ø¹Ù„Ù‰: Ø§Ø³Ù… Ø§Ù„Ø´Ø±ÙƒØ©ØŒ Ø§Ø³Ù… Ø§Ù„Ø¨Ù†ÙƒØŒ ØªÙˆØ§Ø±ÙŠØ®ØŒ ÙˆØµÙ Ø§Ù„Ø­Ø±ÙƒØ§ØªØŒ
   * ÙˆÙ…Ø¨Ø§Ù„Øº Ù…Ø¯ÙŠÙ†/Ø¯Ø§Ø¦Ù†. Ù„Ø§ ØªÙØ±Ø³ÙŽÙ„ Ø£Ø±Ù‚Ø§Ù… Ø­Ø³Ø§Ø¨Ø§Øª Ø¨Ù†ÙƒÙŠØ© ÙƒØ§Ù…Ù„Ø© Ø£Ùˆ ÙƒÙ„Ù…Ø§Øª Ù…Ø±ÙˆØ±.
   * Ø¥Ù† ÙƒØ§Ù† Ù„Ø¯ÙŠÙƒ Ø³ÙŠØ§Ø³Ø© Ø¨ÙŠØ§Ù†Ø§Øª ØµØ§Ø±Ù…Ø©ØŒ Ø§Ø³ØªØ¨Ø¯Ù„ Ù‡Ø°Ù‡ Ø§Ù„Ø¯Ø§Ù„Ø© Ø¨ØªØ­Ù„ÙŠÙ„ Ù…Ø­Ù„ÙŠ.
   */
  async analyzeBankStatementPhase1(raw: string[][]): Promise<BankStatementPhase1Result | null> {
    return analyzeBankStatementPhase1WithGemini({
      apiKey: this.apiKey,
      gate: this.geminiGate,
      logger: this.logger,
      raw,
    });
  }

  /**
   * ØªØ­Ù„ÙŠÙ„ ÙƒØ´Ù Ø­Ø³Ø§Ø¨ â€” Ø®Ø·ÙˆØ© 2: Ø§Ù‚ØªØ±Ø§Ø­ Ù†ÙˆØ¹ ÙƒÙ„ Ø¹Ù…ÙˆØ¯
   *
   * âš ï¸ ØªØ­Ø°ÙŠØ± Ø£Ù…Ù†ÙŠ: ÙŠÙØ±Ø³ÙŽÙ„ Ø¥Ù„Ù‰ Gemini API ØµÙ Ø§Ù„Ø¹Ù†Ø§ÙˆÙŠÙ† Ùˆ5 ØµÙÙˆÙ Ø¹ÙŠÙ‘Ù†Ø© Ù…Ù† Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.
   * Ø§Ù„Ù‡Ø¯Ù: ØªØ­Ø¯ÙŠØ¯ Ø£Ù†ÙˆØ§Ø¹ Ø§Ù„Ø£Ø¹Ù…Ø¯Ø© ÙÙ‚Ø· (ØªØ§Ø±ÙŠØ®ØŒ Ù…Ø¯ÙŠÙ†ØŒ Ø¯Ø§Ø¦Ù†...) ÙˆÙ„ÙŠØ³ Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø§Ù„Ù…Ø¨Ø§Ù„Øº.
   * Ø§Ù„Ù…Ø¨Ø§Ù„Øº Ø§Ù„Ù…ÙØ±Ø³ÙŽÙ„Ø© Ù…Ø­Ø¯ÙˆØ¯Ø© ÙˆÙ…Ù‚ØªØµØ±Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø¹ÙŠÙ‘Ù†Ø© Ø§Ù„ØªØ´Ø®ÙŠØµÙŠØ©.
   */
  async analyzeBankStatementPhase2(raw: string[][], dataStartRow: number, headerRow: number): Promise<Record<number, string> | null> {
    return analyzeBankStatementPhase2WithGemini({
      apiKey: this.apiKey,
      gate: this.geminiGate,
      logger: this.logger,
      raw,
      dataStartRow,
      headerRow,
    });
  }

  /**
   * ØªØ±ÙˆÙŠØ³Ø© Ø§Ù„ÙƒØ´Ù (Ø¹Ù…ÙŠÙ„ØŒ Ø¨Ù†ÙƒØŒ ÙØªØ±Ø©) â€” Ù…Ø·Ø§Ø¨Ù‚Ø© Ø¨Ø±ÙˆÙ…Ø¨Øª InvokeLLM ÙÙŠ BankColumnMapper (Base44)
   */
  async suggestBankStatementHeaderMetadata(raw: string[][]): Promise<BankStatementHeaderMetadata | null> {
    return suggestBankStatementHeaderMetadataWithGemini({
      apiKey: this.apiKey,
      gate: this.geminiGate,
      logger: this.logger,
      raw,
    });
  }

  /** ØªØ­Ù„ÙŠÙ„ ÙƒØ´Ù Ø­Ø³Ø§Ø¨ â€” Ø§Ù„Ø·Ù„Ø¨ Ø§Ù„Ù…ÙˆØ­Ø¯ (Phase1 + Phase2) */
  async analyzeBankStatementStructure(raw: string[][]): Promise<{
    companyName: string;
    reportDate: string;
    dataStartRow: number;
    dataEndRow: number;
    headerRow: number;
    columnTypes: Record<number, string>;
  } | null> {
    const phase1 = await this.analyzeBankStatementPhase1(raw);
    if (!phase1) return null;

    const phase2 = await this.analyzeBankStatementPhase2(raw, phase1.dataStartRow, phase1.headerRow);
    return {
      ...phase1,
      columnTypes: phase2 || {},
    };
  }
}
