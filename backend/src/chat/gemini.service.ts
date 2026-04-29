/**
 * GeminiService — فهم النية من السؤال باستخدام Gemini API
 * يُستخدم فقط لفهم السؤال (intent + period)
 * البيانات الحقيقية تُجلب من المعالجات (handlers) — لا يُرسل أي بيانات مالية لـ Gemini
 *
 * الأمان: المفتاح في backend/.env فقط — يُقرأ عبر gemini.config.ts
 */
import { Injectable, Logger } from '@nestjs/common';
import { getGeminiApiKey, getGeminiIntentConfidenceMin } from '../config/gemini.config';
import { extractJson } from '../common/utils/extract-json.util';
import { getGeminiChatIntentRequestUrl, GEMINI_CHAT_INTENT_SYSTEM_PROMPT, GEMINI_INTENT_FIELD_SCHEMA_DESCRIPTION } from './gemini-chat-intent-prompts.util';
import { toYmd } from '../common/utils/to-ymd.util';
import { normalizeGeminiIntent, normalizeGeminiPeriod } from './gemini-normalize.util';
import { GeminiConcurrencyGate } from './gemini-concurrency.util';
import type { GeminiParseResult } from './gemini-types';

export type { GeminiIntent, GeminiPeriod, GeminiParseResult } from './gemini-types';

/** مطالبة نظام لشرح JSON الرؤى — يُختبر في الوحدات لضمان عدم طلب حسابات جديدة */
export const DASHBOARD_INSIGHTS_LLM_SYSTEM_PROMPT = `You are a financial explanation assistant for NOORIX.
Use only the provided Dashboard Insights JSON.
Do not calculate new financial numbers.
Do not invent missing data.
Do not mention anything not present in the JSON.
Do not create new warnings.
Do not override severity.
Do not provide tax, payroll, VAT, bank, vault, or legal advice.
If the JSON does not support an answer, say the data is not enough.
Keep the answer concise and business-friendly.
Arabic first when the user writes Arabic.
Structure: one short opening sentence on overall status, then 1–3 bullet points based only on warnings/insights from the JSON. If there are no warnings and no relevant insights in the JSON, say the neutral line that current figures do not exceed configured warning thresholds (in both languages).`;

@Injectable()
export class GeminiService {
  private readonly apiKey: string | null;
  private readonly geminiGate = new GeminiConcurrencyGate();
  private readonly logger = new Logger(GeminiService.name);

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

    return this.geminiGate.with(async () => {
    try {
      const response = await fetch(`${getGeminiChatIntentRequestUrl()}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${GEMINI_CHAT_INTENT_SYSTEM_PROMPT}\n\nالسؤال: "${trimmed}"` }],
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

      const data = (await response.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
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
   * شرح JSON الرؤى فقط — لا جلب بيانات ولا حسابات؛ عند الفشل يُرجع null
   */
  async explainDashboardInsights(
    userQuery: string,
    insightsPackage: Record<string, unknown>,
    opts: { prefersArabic: boolean },
  ): Promise<{ answerAr: string; answerEn: string } | null> {
    if (!this.apiKey) return null;
    const trimmed = (userQuery || '').trim();
    if (!trimmed || trimmed.length > 500) return null;

    const pref = opts.prefersArabic
      ? 'The user writes primarily in Arabic: lead with Arabic tone in answerAr; answerEn mirrors the same facts.'
      : 'The user writes primarily in English: lead with English in answerEn; answerAr mirrors the same facts.';

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
                    text: `${DASHBOARD_INSIGHTS_LLM_SYSTEM_PROMPT}\n\n${pref}\n\nDashboard Insights JSON (only source of truth):\n${JSON.stringify(insightsPackage)}\n\nUser question: ${JSON.stringify(trimmed)}\n\nReturn JSON only: {"answerAr":"...","answerEn":"..."}`,
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

        const data = (await response.json()) as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
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
   * إجابة عامة — للأسئلة خارج نطاق النظام (تحيات، أسئلة عامة)
   * للتجربة: عند تفعيل GEMINI_OPEN_MODE=true
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
              parts: [{
                text: `أنت مساعد مفيد داخل تطبيق نوركس (محاسبة). أجب على سؤال المستخدم مباشرة وبشكل مكتمل قدر الحاجة.
- للتحيات: رد بحرية وود دون إلزامه بطرح سؤال محاسبي.
- لأي موضوع عام (علوم، تاريخ، برمجة، نصائح، شرح مفهوم، إلخ): أجب كمساعد عام؛ لا ترفض الإجابة بحجة أنك للمحاسبة فقط.
- يمكنك إن مناسباً أن تذكر في ختام إجابة قصيرة أن نوركس يدعم أيضاً استفسارات المبيعات والخزائن والتقارير — اختياري وليس في كل رد.

السؤال: "${trimmed}"

أرجع JSON فقط: {"answerAr":"النص بالعربية","answerEn":"النص بالإنجليزية"}`,
              }],
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
    });
  }

  /**
   * تحليل كشف حساب — خطوة 1: استخراج البيانات الوصفية ونطاق الجدول
   *
   * ⚠️ تحذير أمني: يُرسَل إلى Gemini API أول 35 صفاً من ملف Excel الخام.
   * قد تحتوي هذه الصفوف على: اسم الشركة، اسم البنك، تواريخ، وصف الحركات،
   * ومبالغ مدين/دائن. لا تُرسَل أرقام حسابات بنكية كاملة أو كلمات مرور.
   * إن كان لديك سياسة بيانات صارمة، استبدل هذه الدالة بتحليل محلي.
   */
  async analyzeBankStatementPhase1(raw: string[][]): Promise<{
    companyName: string;
    reportDate: string;
    dataStartRow: number;
    dataEndRow: number;
    headerRow: number;
  } | null> {
    if (!this.apiKey) return null;
    if (!raw?.length || !Array.isArray(raw[0])) return null;

    const sample = raw.slice(0, 35).map((row) =>
      (Array.isArray(row) ? row : []).map((c) => String(c ?? '').slice(0, 60)).join(' | '),
    );
    const textSample = sample.map((r, i) => `[${i}]: ${r}`).join('\n');
    const lastRow = raw.length - 1;

    const prompt = `كشف حساب بنكي Excel. من العيّنة:

${textSample}

حدد (الأرقام تبدأ من 0):
1. companyName: اسم الشركة من الصفوف الأولى (إن وُجد)
2. reportDate: تاريخ التقرير بصيغة YYYY-MM إن وُجد، وإلا null
3. headerRow: رقم صف العناوين (التاريخ، المدين، الدائن، الوصف...)
4. dataStartRow: أول صف للحركات (بعد العناوين)
5. dataEndRow: آخر صف للحركات (لا يتجاوز ${lastRow})

أرجع JSON فقط:
{"companyName":"...","reportDate":"..." أو null,"headerRow":عدد,"dataStartRow":عدد,"dataEndRow":عدد}`;

    return this.geminiGate.with(async () => {
    try {
      const response = await fetch(`${getGeminiChatIntentRequestUrl()}?key=${this.apiKey}`, {
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
        this.logger.warn(`Phase1 API ${response.status}: ${errText.slice(0, 300)}`);
        return null;
      }
      const data = (await response.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        const reason = data?.candidates?.[0]?.finishReason;
        this.logger.warn(`Phase1 no text, finishReason: ${reason}`);
        return null;
      }

      const parsed = extractJson<{
        companyName?: string;
        reportDate?: string | null;
        headerRow?: number;
        dataStartRow?: number;
        dataEndRow?: number;
      }>(text);

      if (!parsed || parsed.dataStartRow == null) {
        this.logger.warn(`Phase1 parse failed or missing dataStartRow. Raw: ${text.slice(0, 200)}`);
        return null;
      }

      const dataStartRow = Math.max(0, Math.min(raw.length - 1, Math.floor(Number(parsed.dataStartRow) || 0)));
      const dataEndRow = Math.max(
        dataStartRow,
        Math.min(raw.length - 1, Math.floor(Number(parsed.dataEndRow) ?? lastRow)),
      );
      const headerRow = Math.max(0, Math.min(dataStartRow, Math.floor(Number(parsed.headerRow ?? dataStartRow - 1) || 0)));

      return {
        companyName: String(parsed.companyName ?? '').trim() || '',
        reportDate: parsed.reportDate && String(parsed.reportDate).trim() !== 'null' ? String(parsed.reportDate).trim() : '',
        dataStartRow,
        dataEndRow,
        headerRow,
      };
    } catch (err) {
      this.logger.warn(`Phase1 error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
    });
  }

  /**
   * تحليل كشف حساب — خطوة 2: اقتراح نوع كل عمود
   *
   * ⚠️ تحذير أمني: يُرسَل إلى Gemini API صف العناوين و5 صفوف عيّنة من البيانات.
   * الهدف: تحديد أنواع الأعمدة فقط (تاريخ، مدين، دائن...) وليس استخراج المبالغ.
   * المبالغ المُرسَلة محدودة ومقتصرة على العيّنة التشخيصية.
   */
  async analyzeBankStatementPhase2(raw: string[][], dataStartRow: number, headerRow: number): Promise<Record<number, string> | null> {
    if (!this.apiKey) return null;
    if (!raw?.length || !Array.isArray(raw[0])) return null;

    const colCount = Math.max(...raw.map((r) => (Array.isArray(r) ? r.length : 0)), 1);
    const headerCells = (raw[headerRow] || []).map((c, i) => `col${i}:"${String(c ?? '').slice(0, 30)}"`).join(', ');
    const sampleRows = raw
      .slice(dataStartRow, dataStartRow + 5)
      .map((row, idx) => {
        const cells = (Array.isArray(row) ? row : []).map((c, i) => `[${i}]:"${String(c ?? '').slice(0, 25)}"`).join(' ');
        return `row${idx}: ${cells}`;
      })
      .join('\n');

    const prompt = `كشف حساب بنكي. العناوين (صف ${headerRow}):
${headerCells}

عيّنة بيانات:
${sampleRows}

لكل عمود 0 إلى ${colCount - 1} اختر: date | debit | credit | amount | description | notes | balance | reference | ignore
(notes = ملاحظات إضافية تُدمج مع الوصف، reference = مرجع/رقم عملية)
أرجع JSON فقط: {"0":"نوع","1":"نوع",...}`;

    return this.geminiGate.with(async () => {
    try {
      const response = await fetch(`${getGeminiChatIntentRequestUrl()}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.05, maxOutputTokens: 512, responseMimeType: 'application/json' },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.warn(`Phase2 API ${response.status}: ${errText.slice(0, 300)}`);
        return null;
      }
      const data = (await response.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        this.logger.warn(`Phase2 no text`);
        return null;
      }

      const parsed = extractJson<Record<string, string>>(text);
      if (!parsed || typeof parsed !== 'object') {
        this.logger.warn(`Phase2 parse failed. Raw: ${text.slice(0, 200)}`);
        return null;
      }

      const validTypes = [
        'date',
        'debit',
        'credit',
        'amount',
        'description',
        'notes',
        'balance',
        'reference',
        'ignore',
      ];
      const columnTypes: Record<number, string> = {};
      for (let i = 0; i < colCount; i++) {
        const t = String(parsed[String(i)] ?? 'ignore').toLowerCase();
        columnTypes[i] = validTypes.includes(t) ? t : 'ignore';
      }
      return columnTypes;
    } catch (err) {
      this.logger.warn(`Phase2 error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
    });
  }

  /**
   * ترويسة الكشف (عميل، بنك، فترة) — مطابقة برومبت InvokeLLM في BankColumnMapper (Base44)
   */
  async suggestBankStatementHeaderMetadata(raw: string[][]): Promise<{
    customerName: string;
    bankName: string;
    periodFrom: string;
    periodTo: string;
  } | null> {
    if (!this.apiKey || !raw?.length) return null;

    const slice = raw.slice(0, Math.min(22, raw.length));
    const headerText = slice
      .map((row, idx) => {
        const parts = (row || []).map((c, ci) => {
          if (c === '' || c == null) return '';
          const s = String(c).trim().slice(0, 120);
          return s ? `[${ci}]${s}` : '';
        });
        return `سطر ${idx}: ${parts.filter(Boolean).join(' | ')}`;
      })
      .join('\n');

    const prompt = `حلل ترويسة كشف الحساب البنكي التالي واستخرج المعلومات:

${headerText}

استخرج:
- customer_name: اسم الشركة/المؤسسة/العميل صاحب الحساب (ليس اسم البنك!)
- bank_name: اسم البنك
- period_from: تاريخ بداية الفترة (صيغة YYYY-MM-DD)
- period_to: تاريخ نهاية الفترة (صيغة YYYY-MM-DD)

أرجع JSON فقط. إذا لم تجد معلومة اتركها فارغة "".`;

    return this.geminiGate.with(async () => {
    try {
      const response = await fetch(`${getGeminiChatIntentRequestUrl()}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.05, maxOutputTokens: 512, responseMimeType: 'application/json' },
        }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      const parsed = extractJson<{
        customer_name?: string;
        bank_name?: string;
        period_from?: string;
        period_to?: string;
      }>(text);
      if (!parsed) return null;
      const norm = (s: unknown) => String(s ?? '').trim().slice(0, 200);
      return {
        customerName: norm(parsed.customer_name),
        bankName: norm(parsed.bank_name),
        periodFrom: toYmd(norm(parsed.period_from)),
        periodTo: toYmd(norm(parsed.period_to)),
      };
    } catch (err) {
      this.logger.warn(`suggestBankStatementHeaderMetadata: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
    });
  }

  /** تحليل كشف حساب — الطلب الموحد (Phase1 + Phase2) */
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
