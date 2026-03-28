/**
 * GeminiService — فهم النية من السؤال باستخدام Gemini API
 * يُستخدم فقط لفهم السؤال (intent + period)
 * البيانات الحقيقية تُجلب من المعالجات (handlers) — لا يُرسل أي بيانات مالية لـ Gemini
 *
 * الأمان: المفتاح في backend/.env فقط — يُقرأ عبر gemini.config.ts
 */
import { Injectable, Logger } from '@nestjs/common';
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
- help: مساعدة، ماذا تسأل، أسئلة، ماذا يمكن أن تفعل (طلب صريح لقائمة المساعدة)
- unknown: تحيات (مرحبا، أهلا، السلام، كيف الحال)، أسئلة عامة خارج المحاسبة، أو أي سؤال لا ينطبق على القائمة

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
    if (!trimmed || trimmed.length > 1200) return null;

    try {
      const response = await fetch(`${getGeminiUrl()}?key=${this.apiKey}`, {
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
  }

  private readonly logger = new Logger(GeminiService.name);

  /**
   * تحليل كشف حساب — خطوة 1: استخراج البيانات الوصفية ونطاق الجدول
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

    try {
      const response = await fetch(`${getGeminiUrl()}?key=${this.apiKey}`, {
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
  }

  /**
   * تحليل كشف حساب — خطوة 2: اقتراح نوع كل عمود
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

    try {
      const response = await fetch(`${getGeminiUrl()}?key=${this.apiKey}`, {
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

    try {
      const response = await fetch(`${getGeminiUrl()}?key=${this.apiKey}`, {
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
        periodFrom: norm(parsed.period_from).slice(0, 10),
        periodTo: norm(parsed.period_to).slice(0, 10),
      };
    } catch (err) {
      this.logger.warn(`suggestBankStatementHeaderMetadata: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
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
