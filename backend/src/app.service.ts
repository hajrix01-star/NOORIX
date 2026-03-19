import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { getGeminiApiKey, getGeminiModel, isGeminiAvailable } from './config/gemini.config';

function extractJson<T = Record<string, unknown>>(text: string): T | null {
  let t = (text || '').trim();
  if (!t) return null;
  // استخراج من ```json ... ``` أو ``` ... ```
  const codeBlockMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) t = codeBlockMatch[1].trim();
  try {
    return JSON.parse(t) as T;
  } catch {
    const start = t.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let end = -1;
    for (let i = start; i < t.length; i++) {
      if (t[i] === '{') depth++;
      else if (t[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) return null;
    const jsonStr = t.slice(start, end + 1);
    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      // محاولة إصلاح علامات الاقتباس المفردة
      const fixed = jsonStr.replace(/(\w+):\s*'([^']*)'/g, '"$1":"$2"');
      try {
        return JSON.parse(fixed) as T;
      } catch {
        return null;
      }
    }
  }
}

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    let dbConnected = false;
    let adminExists = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
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
      adminExists,
    };
  }

  /** اختبار Gemini فعلياً — يُستخدم للتشخيص */
  async testGemini(): Promise<{ ok: boolean; error?: string; intent?: string }> {
    const key = getGeminiApiKey();
    if (!key) return { ok: false, error: 'GEMINI_API_KEY غير مُعرّف' };

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent`;
      const res = await fetch(`${url}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Extract intent from: "كم المبيعات اليوم". Return intent as "sales".' }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 64,
            responseMimeType: 'application/json',
            responseJsonSchema: {
              type: 'object',
              properties: { intent: { type: 'string', description: 'Intent: sales, purchases, expenses, etc.' } },
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
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      if (!text) {
        const blockReason = data?.candidates?.[0]?.finishReason;
        return { ok: false, error: blockReason ? `حظر: ${blockReason}` : 'لا استجابة من Gemini' };
      }
      const parsed = extractJson<{ intent?: string }>(text);
      return parsed ? { ok: true, intent: parsed.intent } : { ok: false, error: `لا JSON صالح. الاستجابة: ${text.slice(0, 120)}...` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
