/**
 * أنواع معالجات المحادثة الذكية
 */
export type ChatHandlerContext = {
  companyId: string;
  query: string;
  userRole: string;
  now: Date;
  year: number;
  month: number;
  period: { start: Date; end: Date; labelAr: string; labelEn: string } | null;
  can: (permission: string) => boolean;
  prisma: any;
  reportsService: any;
  vaultsService: any;
};

/** مخطط مقارنة شهريّين (أعمدة) */
export type ChatChartMonthCompare = {
  kind: 'monthCompare';
  bars: Array<{ key: string; labelAr: string; labelEn: string; value: number }>;
};

/** شريط مكدّس: نسب المشتريات/المصروفات من المبيعات */
export type ChatChartFinanceRatios = {
  kind: 'financeRatios';
  segments: Array<{ key: 'purchases' | 'expenses'; pct: number }>;
};

/** بيانات اختيارية للواجهة (مثلاً رسم بسيط) — لا تُرسل لـ Gemini */
export type ChatResponseExtras = {
  chart?: ChatChartMonthCompare | ChatChartFinanceRatios;
};

export type ChatHandlerResult = {
  answerAr: string;
  answerEn: string;
  extras?: ChatResponseExtras;
};

export type GeminiIntent =
  | 'sales' | 'purchases' | 'expenses' | 'reports' | 'vaults'
  | 'invoices' | 'suppliers' | 'categories' | 'expense_lines' | 'hr' | 'orders' | 'help'
  | 'finance_ratios'
  | 'sales_month_compare'
  | 'unknown';

export type ChatHandler = {
  /** أولوية التنفيذ (أقل = أولاً) */
  priority?: number;
  /** النية من Gemini (للربط السريع) */
  intent?: GeminiIntent;
  /** هل يستطيع معالجة السؤال؟ */
  canHandle: (q: string, can: (p: string) => boolean) => boolean;
  /** هل يطابق النية من Gemini؟ */
  matchesIntent?: (intent: GeminiIntent, can: (p: string) => boolean) => boolean;
  /** تنفيذ الاستعلام وإرجاع الإجابة */
  process: (ctx: ChatHandlerContext) => Promise<ChatHandlerResult | null>;
};
