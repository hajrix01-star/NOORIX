import { extractJson } from '../common/utils/extract-json.util';
import { getGeminiChatIntentRequestUrl } from './gemini-chat-intent-prompts.util';
import { GeminiConcurrencyGate } from './gemini-concurrency.util';
import {
  buildBankStatementHeaderMetadataPrompt,
  buildBankStatementPhase1Prompt,
  buildBankStatementPhase2Prompt,
  normalizeBankStatementColumnTypes,
  normalizeBankStatementHeaderMetadata,
  normalizeBankStatementPhase1,
  type BankStatementHeaderMetadata,
  type BankStatementPhase1Result,
} from './gemini-bank-statement-prompts.util';
import {
  getGeminiCandidateText,
  getGeminiFinishReason,
  type GeminiGenerateContentResponse,
} from './gemini-response.util';

type GeminiBankStatementLogger = {
  warn(message: string): void;
};

export async function analyzeBankStatementPhase1WithGemini(params: {
  apiKey: string | null;
  gate: GeminiConcurrencyGate;
  logger: GeminiBankStatementLogger;
  raw: string[][];
}): Promise<BankStatementPhase1Result | null> {
  if (!params.apiKey) return null;
  if (!params.raw?.length || !Array.isArray(params.raw[0])) return null;

  const prompt = buildBankStatementPhase1Prompt(params.raw);

  return params.gate.with(async () => {
    try {
      const response = await fetch(`${getGeminiChatIntentRequestUrl()}?key=${params.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.05,
            maxOutputTokens: 256,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        params.logger.warn(`Phase1 API ${response.status}: ${errText.slice(0, 300)}`);
        return null;
      }

      const data: GeminiGenerateContentResponse = await response.json();
      const text = getGeminiCandidateText(data);
      if (!text) {
        params.logger.warn(`Phase1 no text, finishReason: ${getGeminiFinishReason(data)}`);
        return null;
      }

      const parsed = extractJson<{
        companyName?: string;
        reportDate?: string | null;
        headerRow?: number;
        dataStartRow?: number;
        dataEndRow?: number;
      }>(text);
      if (!parsed) {
        params.logger.warn(`Phase1 parse failed or missing dataStartRow. Raw: ${text.slice(0, 200)}`);
        return null;
      }

      const normalized = normalizeBankStatementPhase1(parsed, params.raw.length);
      if (!normalized) {
        params.logger.warn(`Phase1 parse failed or missing dataStartRow. Raw: ${text.slice(0, 200)}`);
        return null;
      }

      return normalized;
    } catch (err) {
      params.logger.warn(`Phase1 error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });
}

export async function analyzeBankStatementPhase2WithGemini(params: {
  apiKey: string | null;
  gate: GeminiConcurrencyGate;
  logger: GeminiBankStatementLogger;
  raw: string[][];
  dataStartRow: number;
  headerRow: number;
}): Promise<Record<number, string> | null> {
  if (!params.apiKey) return null;
  if (!params.raw?.length || !Array.isArray(params.raw[0])) return null;

  const { prompt, colCount } = buildBankStatementPhase2Prompt(params.raw, params.dataStartRow, params.headerRow);

  return params.gate.with(async () => {
    try {
      const response = await fetch(`${getGeminiChatIntentRequestUrl()}?key=${params.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.05, maxOutputTokens: 512, responseMimeType: 'application/json' },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        params.logger.warn(`Phase2 API ${response.status}: ${errText.slice(0, 300)}`);
        return null;
      }

      const data: GeminiGenerateContentResponse = await response.json();
      const text = getGeminiCandidateText(data);
      if (!text) {
        params.logger.warn('Phase2 no text');
        return null;
      }

      const parsed = extractJson<Record<string, string>>(text);
      if (!parsed || typeof parsed !== 'object') {
        params.logger.warn(`Phase2 parse failed. Raw: ${text.slice(0, 200)}`);
        return null;
      }

      return normalizeBankStatementColumnTypes(parsed, colCount);
    } catch (err) {
      params.logger.warn(`Phase2 error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });
}

export async function suggestBankStatementHeaderMetadataWithGemini(params: {
  apiKey: string | null;
  gate: GeminiConcurrencyGate;
  logger: GeminiBankStatementLogger;
  raw: string[][];
}): Promise<BankStatementHeaderMetadata | null> {
  if (!params.apiKey || !params.raw?.length) return null;

  const prompt = buildBankStatementHeaderMetadataPrompt(params.raw);

  return params.gate.with(async () => {
    try {
      const response = await fetch(`${getGeminiChatIntentRequestUrl()}?key=${params.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.05, maxOutputTokens: 512, responseMimeType: 'application/json' },
        }),
      });
      if (!response.ok) return null;

      const data: GeminiGenerateContentResponse = await response.json();
      const text = getGeminiCandidateText(data);
      if (!text) return null;

      const parsed = extractJson<{
        customer_name?: string;
        bank_name?: string;
        period_from?: string;
        period_to?: string;
      }>(text);
      return parsed ? normalizeBankStatementHeaderMetadata(parsed) : null;
    } catch (err) {
      params.logger.warn(`suggestBankStatementHeaderMetadata: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });
}
