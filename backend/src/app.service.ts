import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { getGeminiApiKey, getGeminiModel, isGeminiAvailable } from './config/gemini.config';

function extractJson<T = Record<string, unknown>>(text: string): T | null {
  let t = String(text || '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (!t) return null;
  // استخراج من ```json ... ``` أو ``` ... ```
  const codeBlockMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) t = codeBlockMatch[1].trim();
  // استخراج أول كائن JSON من النص (لنماذج تضع شرحاً قبل أو بعد)
  const start = t.indexOf('{');
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < t.length; i++) {
      if (t[i] === '{') depth++;
      else if (t[i] === '}') {
        depth--;
        if (depth === 0) {
          const jsonStr = t.slice(start, i + 1);
          try {
            return JSON.parse(jsonStr) as T;
          } catch {
            try {
              const fixed = jsonStr.replace(/(\w+):\s*'([^']*)'/g, '"$1":"$2"');
              return JSON.parse(fixed) as T;
            } catch {
              break;
            }
          }
        }
      }
    }
  }
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
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
        where: { email: 'admin@noorix.sa' },
        select: { id: true },
      });
      adminExists = !!admin;
    } catch {
      // db error
    }
    return {
      status: 'ok',
      service: 'noorix-backend',
      version: '0.1.0',
      geminiAvailable: isGeminiAvailable(),
      dbConnected,
      dbLatencyMs,
      adminExists,
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
      const data = (await res.json()) as Record<string, unknown>;
      const text = (data?.candidates as any)?.[0]?.content?.parts?.[0]?.text ?? null;
      if (!text) {
        const blockReason = (data?.candidates as any)?.[0]?.finishReason;
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
      const fallbackData = (await fallbackRes.json()) as Record<string, unknown>;
      const fallbackText = (fallbackData?.candidates as any)?.[0]?.content?.parts?.[0]?.text ?? null;
      const fallbackParsed = fallbackText ? extractJson<{ intent?: string }>(fallbackText) : null;
      return fallbackParsed && typeof fallbackParsed === 'object'
        ? { ok: true, intent: String(fallbackParsed.intent ?? 'sales') }
        : { ok: false, error: `لا JSON صالح. الاستجابة: ${String(text).slice(0, 150)}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
