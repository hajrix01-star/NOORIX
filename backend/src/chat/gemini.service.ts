/**
 * GeminiService — فهم النية من السؤال باستخدام Gemini API
 * يُستخدم فقط لفهم السؤال (intent + period)
 * البيانات الحقيقية تُجلب من المعالجات (handlers) — لا يُرسل أي بيانات مالية لـ Gemini
 *
 * الأمان: المفتاح في backend/.env فقط — يُقرأ عبر gemini.config.ts
 */
import { Injectable } from '@nestjs/common';
import { getGeminiApiKey, getGeminiModel } from '../config/gemini.config';

function getGeminiUrl(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent`;
}

/** استخراج JSON من نص قد يحتوي على شرح أو كود markdown */
function extractJson<T = Record<string, unknown>>(text: string): T | null {
  let t = (text || '').trim();
  if (!t) return null;
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
      const fixed = jsonStr.replace(/(\w+):\s*'([^']*)'/g, '"$1":"$2"');
      try {
        return JSON.parse(fixed) as T;
      } catch {
        return null;
      }
    }
  }
}

export type GeminiIntent =
  | 'sales'
  | 'purchases'
  | 'expenses'
  | 'reports'
  | 'vaults'
  | 'invoices'
  | 'suppliers'
  | 'categories'
  | 'expense_lines'
  | 'hr'
  | 'orders'
  | 'help'
  | 'unknown';

export type GeminiPeriod =
  | 'today'
  | 'yesterday'
  | 'day_before_yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'year'
  | null;

export type GeminiParseResult = {
  intent: GeminiIntent;
  period: GeminiPeriod;
  rawQuery: string;
};

const SYSTEM_PROMPT = `أنت مساعد لفهم أسئلة في نظام محاسبة سعودي (نوركس).
المهمة: استخرج من السؤال النية (intent) والفترة (period) فقط.
أرجع JSON صحيح فقط بدون أي نص إضافي.

النية (intent) — اختر واحدة فقط:
- sales: مبيعات، إيرادات، كم حققنا، كم بيعنا، كم كسبنا، كم ربحنا، دخلنا
- purchases: مشتريات، كم اشترينا
- expenses: مصروفات، مصاريف، كم صرفنا
- reports: ربح، خسارة، تقرير، ملخص
- vaults: خزائن، أرصدة، رصيد، بنك
- invoices: فواتير، آخر فاتورة
- suppliers: موردين، مورد
- categories: فئات
- expense_lines: بنود مصروفات
- hr: موظفين، اسم الموظف، أسماء الموظفين، رواتب، إجازات، إقامات، مسيرة
- orders: طلبات، أصناف، منتجات
- help: مساعدة، ماذا تسأل، أسئلة
- unknown: إذا لم يتطابق

الفترة (period) — اختر واحدة أو null:
- today: اليوم
- yesterday: أمس
- day_before_yesterday: أول أمس، قبل يومين
- this_week: هذا الأسبوع
- last_week: الأسبوع الماضي
- this_month: هذا الشهر
- last_month: الشهر الماضي
- year: السنة (إذا لم تذكر فترة أو ذكرت السنة)
- null: إذا لم تذكر فترة

الصيغة: {"intent":"...","period":"..." أو null}
مهم: أرجع JSON فقط بدون أي كلمات قبل أو بعد. لا تكتب "Here is" أو "النتيجة" أو أي نص آخر.`;

@Injectable()
export class GeminiService {
  private readonly apiKey: string | null;

  constructor() {
    this.apiKey = getGeminiApiKey();
  }

  /** هل الخدمة متاحة (مفتاح موجود)؟ */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * فهم النية من السؤال باستخدام Gemini
   * لا يُرسل أي بيانات مالية — فقط نص السؤال
   */
  async parseIntent(query: string): Promise<GeminiParseResult | null> {
    if (!this.apiKey) return null;

    const trimmed = (query || '').trim();
    if (!trimmed || trimmed.length > 500) return null;

    try {
      const response = await fetch(`${getGeminiUrl()}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${SYSTEM_PROMPT}\n\nالسؤال: "${trimmed}"` }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 128,
            responseMimeType: 'application/json',
            responseJsonSchema: {
              type: 'object',
              properties: {
                intent: { type: 'string', description: 'One of: sales, purchases, expenses, reports, vaults, invoices, suppliers, categories, expense_lines, hr, orders, help, unknown' },
                period: { type: 'string', description: 'One of: today, yesterday, day_before_yesterday, this_week, last_week, this_month, last_month, year, or null' },
              },
              required: ['intent'],
            },
          },
        }),
      });

      if (!response.ok) {
        console.warn('[GeminiService] API error:', response.status, await response.text());
        return null;
      }

      const data = (await response.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      const parsed = extractJson<{ intent?: string; period?: string | null }>(text);
      if (!parsed) return null;
      const intent = this.normalizeIntent(parsed?.intent);
      const period = this.normalizePeriod(parsed?.period);

      return { intent, period, rawQuery: trimmed };
    } catch (err) {
      console.warn('[GeminiService] Parse error:', err);
      return null;
    }
  }

  private normalizeIntent(v: unknown): GeminiIntent {
    const s = String(v || '').toLowerCase();
    const valid: GeminiIntent[] = [
      'sales', 'purchases', 'expenses', 'reports', 'vaults',
      'invoices', 'suppliers', 'categories', 'expense_lines', 'hr', 'orders', 'help', 'unknown',
    ];
    return valid.includes(s as GeminiIntent) ? (s as GeminiIntent) : 'unknown';
  }

  /**
   * إجابة عامة — للأسئلة خارج نطاق النظام (تحيات، أسئلة عامة)
   * للتجربة: عند تفعيل GEMINI_OPEN_MODE=true
   */
  async answerGeneral(query: string): Promise<{ answerAr: string; answerEn: string } | null> {
    if (!this.apiKey) return null;

    const trimmed = (query || '').trim();
    if (!trimmed || trimmed.length > 300) return null;

    try {
      const response = await fetch(`${getGeminiUrl()}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{
                text: `أنت مساعد ودود في نظام محاسبة سعودي (نوركس). أجب على السؤال التالي بإيجاز (جملة أو جملتين) بالعربية والإنجليزية.
إذا كان تحية: رد بتحية ودودة واقترح أن يسأل عن المبيعات أو الخزائن أو التقارير.
إذا كان سؤالاً عاماً: أجب بإيجاز ثم اذكر أنك متخصص بأسئلة المحاسبة والمالية.

السؤال: "${trimmed}"

أرجع JSON فقط: {"answerAr":"النص بالعربية","answerEn":"النص بالإنجليزية"}`,
              }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 256,
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

      const data = (await response.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
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
  }

  private normalizePeriod(v: unknown): GeminiPeriod {
    if (v === null || v === undefined) return null;
    const s = String(v).toLowerCase();
    const valid: GeminiPeriod[] = [
      'today', 'yesterday', 'day_before_yesterday',
      'this_week', 'last_week', 'this_month', 'last_month', 'year',
    ];
    return valid.includes(s as GeminiPeriod) ? (s as GeminiPeriod) : null;
  }
}
