/**
 * ChatService — معالجة استعلامات المحادثة الذكية
 * يستخدم معالجات معيارية (handlers) لكل مجال
 * عند توفر GEMINI_API_KEY: يفهم النية عبر Gemini ثم يوجّه للمعالج المناسب
 * عند عدم التوفر: fallback لمطابقة الكلمات المفتاحية
 */
import { Injectable, Logger } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ReportsService } from '../reports/reports.service';
import { VaultsService } from '../vaults/vaults.service';
import { DashboardInsightsService } from '../reporting/insights/dashboard-insights.service';
import { ReportingInsightsAggregatorService } from '../reporting/insights/reporting-insights-aggregator.service';
import { PERMISSIONS, hasPermission } from '../auth/constants/permissions';
import { CHAT_HANDLERS } from './handlers';
import type { ChatResponseExtras } from './handlers/types';
import { normalizeQuery, parsePeriod } from './handlers/utils';
import { classifyDashboardInsightsQuery } from './handlers/dashboard-insights.handler';
import { GeminiService } from './gemini.service';
import type { GeminiParseResult } from './gemini-types';
import { isGeminiOpenModeEnabled, isSmartChatInsightsLlmExplanationEnabled } from '../config/gemini.config';

import { SMART_CHAT_UNSUPPORTED_ANSWER_AR, SMART_CHAT_UNSUPPORTED_ANSWER_EN } from './smart-chat-messages';

export type SmartChatProcessQueryMeta = {
  intentSource: 'gemini' | 'keyword';
  intent?: string;
  /** ثقة تصنيف Gemini (0–1) عند توفرها */
  intentConfidence?: number;
  /** النية التي اقترحها النموذج قبل رفضها لانخفاض الثقة */
  geminiSuggestedIntent?: string;
  /** true عند تجاهل توجيه Gemini والاعتماد على الكلمات بسبب ثقة منخفضة */
  geminiIntentRejected?: boolean;
  /** نية Gemini قبل إعادة التوجيه البرمجية (مثل purchases → dashboard_insights لعبارة تحليل) */
  geminiIntent?: string;
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly reportsService: ReportsService,
    private readonly vaultsService: VaultsService,
    private readonly dashboardInsightsService: DashboardInsightsService,
    private readonly reportingInsightsAggregatorService: ReportingInsightsAggregatorService,
    private readonly geminiService: GeminiService,
  ) {}

  async processQuery(
    companyId: string,
    query: string,
    userRole: string,
    userPermissions?: string[],
  ): Promise<{
    answerAr: string;
    answerEn: string;
    meta?: SmartChatProcessQueryMeta;
    extras?: ChatResponseExtras;
  }> {
    const q = normalizeQuery(query);
    const can = (p: string) => hasPermission(userRole, p as any, userPermissions);

    if (!can(PERMISSIONS.SMART_CHAT_READ)) {
      return {
        answerAr: 'ليس لديك صلاحية استخدام المحادثة الذكية. تواصل مع المسؤول.',
        answerEn: 'You do not have permission to use Smart Chat. Contact your administrator.',
        meta: { intentSource: 'keyword' },
      };
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const period = parsePeriod(q, now);

    const insightsLlmExplain =
      isSmartChatInsightsLlmExplanationEnabled() && this.geminiService.isAvailable()
        ? (q: string, pack: Record<string, unknown>, opts: { prefersArabic: boolean }) =>
            this.geminiService.explainDashboardInsights(q, pack, opts)
        : undefined;

    const baseCtx = {
      companyId,
      query: q,
      userRole,
      now,
      year,
      month,
      period,
      can,
      prisma: this.prisma,
      reportsService: this.reportsService,
      vaultsService: this.vaultsService,
      dashboardInsightsService: this.dashboardInsightsService,
      reportingInsightsAggregatorService: this.reportingInsightsAggregatorService,
      intentSource: 'keyword' as const,
      insightsLlmExplain,
    };

    let lastGeminiParse: GeminiParseResult | null = null;

    // ─── محاولة فهم النية عبر Gemini (إن توفر المفتاح) ───
    if (this.geminiService.isAvailable()) {
      try {
        const parsed = await this.geminiService.parseIntent(query);
        lastGeminiParse = parsed;
        if (parsed && parsed.intent !== 'unknown') {
          /** Avoid KPI handlers when wording is a dashboard_insights phrase (e.g. Gemini returns purchases for "حلل المشتريات"). */
          const isDashboardInsightsPhrase = classifyDashboardInsightsQuery(q) != null;
          const rawGeminiIntent = parsed.intent;
          const routingIntent =
            isDashboardInsightsPhrase && (parsed.intent === 'purchases' || parsed.intent === 'expenses')
              ? 'dashboard_insights'
              : parsed.intent;
          const geminiCtx = {
            ...baseCtx,
            intentSource: 'gemini' as const,
            parsedIntent: routingIntent,
          };
          for (const handler of CHAT_HANDLERS) {
            if (handler.matchesIntent?.(routingIntent, can)) {
              const result = await handler.process(geminiCtx);
              if (result) {
                const meta: SmartChatProcessQueryMeta = {
                  intentSource: 'gemini',
                  intent: routingIntent,
                  ...(parsed.confidence !== undefined ? { intentConfidence: parsed.confidence } : {}),
                  ...(rawGeminiIntent !== routingIntent ? { geminiIntent: rawGeminiIntent } : {}),
                };
                return { ...result, meta };
              }
            }
          }
        } else if (parsed?.intent === 'unknown' && !parsed.confidenceRejected) {
          this.logger.debug(`Gemini returned unknown intent for query (first 120 chars): ${q.slice(0, 120)}`);
        }
      } catch {
        // fallback إلى الكلمات المفتاحية
      }
    }

    // ─── مطابقة الكلمات المفتاحية (fallback أو عند عدم توفر Gemini) ───
    for (const handler of CHAT_HANDLERS) {
      if (handler.canHandle(q, can)) {
        const result = await handler.process(baseCtx);
        if (result) {
          const meta: SmartChatProcessQueryMeta = { intentSource: 'keyword' };
          if (lastGeminiParse?.confidenceRejected) {
            meta.geminiIntentRejected = true;
            if (lastGeminiParse.confidence !== undefined) meta.intentConfidence = lastGeminiParse.confidence;
            if (lastGeminiParse.rejectedModelIntent) meta.geminiSuggestedIntent = lastGeminiParse.rejectedModelIntent;
          }
          return { ...result, meta };
        }
      }
    }

    // ─── إجابة عامة عبر Gemini (للأسئلة خارج النظام) — عند تفعيل GEMINI_OPEN_MODE ───
    if (this.geminiService.isAvailable() && isGeminiOpenModeEnabled()) {
      try {
        const general = await this.geminiService.answerGeneral(query);
        if (general)
          return {
            ...general,
            meta: { intentSource: 'gemini', intent: 'general', ...(lastGeminiParse?.confidence !== undefined ? { intentConfidence: lastGeminiParse.confidence } : {}) },
          };
      } catch {
        // fallback للرد الافتراضي
      }
    }

    return {
      answerAr: SMART_CHAT_UNSUPPORTED_ANSWER_AR,
      answerEn: SMART_CHAT_UNSUPPORTED_ANSWER_EN,
      meta: { intentSource: 'keyword' },
    };
  }
}
