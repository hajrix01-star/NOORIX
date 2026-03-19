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

export type ChatHandlerResult = {
  answerAr: string;
  answerEn: string;
};

export type GeminiIntent =
  | 'sales' | 'purchases' | 'expenses' | 'reports' | 'vaults'
  | 'invoices' | 'suppliers' | 'categories' | 'expense_lines' | 'hr' | 'orders' | 'help' | 'unknown';

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
