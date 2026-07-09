import { Injectable } from '@nestjs/common';
import { DEFAULT_ADMIN_EMAIL } from './common/official-email';
import { PrismaService } from './prisma/prisma.service';
import { getGeminiApiKey, getGeminiModel, isGeminiAvailable } from './config/gemini.config';
import { extractJson } from './common/utils/extract-json.util';

type GeminiPart = {
  text?: string;
};

type GeminiCandidate = {
  finishReason?: string;
  content?: {
    parts?: GeminiPart[];
  };
};

type GeminiGenerateContentResponse = {
  candidates?: GeminiCandidate[];
};

function getGeminiFirstCandidate(data: unknown): GeminiCandidate | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const { candidates } = data as GeminiGenerateContentResponse;
  return Array.isArray(candidates) ? candidates[0] : undefined;
}

function getGeminiCandidateText(data: unknown): string | null {
  const text = getGeminiFirstCandidate(data)?.content?.parts?.[0]?.text;
  return typeof text === 'string' ? text : null;
}

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    let dbConnected = false;
    let adminExists = false;
    let dbLatencyMs: number | null = null;
    try {
      const t0 = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - t0;
      dbConnected = true;
      const admin = await this.prisma.user.findUnique({
        where: { email: DEFAULT_ADMIN_EMAIL },
        select: { id: true },
      });
      adminExists = !!admin;
    } catch {
      // db error
    }
    const version =
      (process.env.DEPLOY_SHA || process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || '')
        .trim() || null;
    return {
      status: dbConnected ? 'ok' : 'degraded',
      service: 'noorix-backend',
      dbConnected,
      dbLatencyMs,
      adminExists,
      version,
      uptimeSec: Math.floor(process.uptime()),
    };
  }

  /** اختبار Gemini فعلياً — يُستخدم للتشخيص */
  async testGemini(): Promise<{ ok: boolean; error?: string; intent?: string }> {
    const key = getGeminiApiKey();
    if (!key) return { ok: false, error: 'GEMINI_API_KEY غير مُعرّف' };

    const model = getGeminiModel();
    const prompt = 'Return only a JSON object with one key "intent" and value "sales". Example: {"intent":"sales"}';
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const res = await fetch(`${url}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 128,
            responseMimeType: 'application/json',
            responseJsonSchema: {
              type: 'object',
              properties: { intent: { type: 'string' } },
              required: ['intent'],
            },
          },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `API ${res.status}: ${text.slice(0, 200)}` };
      }
      const data = await res.json();
      const text = getGeminiCandidateText(data);
      if (!text) {
        const blockReason = getGeminiFirstCandidate(data)?.finishReason;
        return { ok: false, error: blockReason ? `حظر: ${blockReason}` : 'لا استجابة من Gemini' };
      }
      const parsed = extractJson<{ intent?: string }>(text);
      if (parsed && typeof parsed === 'object') {
        return { ok: true, intent: String(parsed.intent ?? 'sales') };
      }
      // بعض النماذج لا تدعم responseSchema — تجربة بدونها
      const fallbackRes = await fetch(`${url}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with ONLY this exact JSON, nothing else: {"intent":"sales"}' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 64 },
        }),
      });
      if (!fallbackRes.ok) {
        return { ok: false, error: `لا JSON صالح. الاستجابة: ${String(text).slice(0, 150)}` };
      }
      const fallbackData = await fallbackRes.json();
      const fallbackText = getGeminiCandidateText(fallbackData);
      const fallbackParsed = fallbackText ? extractJson<{ intent?: string }>(fallbackText) : null;
      return fallbackParsed && typeof fallbackParsed === 'object'
        ? { ok: true, intent: String(fallbackParsed.intent ?? 'sales') }
        : { ok: false, error: `لا JSON صالح. الاستجابة: ${String(text).slice(0, 150)}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
