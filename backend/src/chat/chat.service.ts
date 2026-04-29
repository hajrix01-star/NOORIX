/**
 * ChatService — معالجة استعلامات المحادثة الذكية
 * يستخدم معالجات معيارية (handlers) لكل مجال
 * عند توفر GEMINI_API_KEY: يفهم النية عبر Gemini ثم يوجّه للمعالج المناسب
 * عند عدم التوفر: fallback لمطابقة الكلمات المفتاحية
 */
import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ReportsService } from '../reports/reports.service';
import { VaultsService } from '../vaults/vaults.service';
import { DashboardInsightsService } from '../reporting/insights/dashboard-insights.service';
import { PERMISSIONS, hasPermission } from '../auth/constants/permissions';
import { CHAT_HANDLERS } from './handlers';
import type { ChatResponseExtras } from './handlers/types';
import { normalizeQuery, parsePeriod } from './handlers/utils';
import { GeminiService } from './gemini.service';
import { isGeminiOpenModeEnabled, isSmartChatInsightsLlmExplanationEnabled } from '../config/gemini.config';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly reportsService: ReportsService,
    private readonly vaultsService: VaultsService,
    private readonly dashboardInsightsService: DashboardInsightsService,
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
    meta?: { intentSource: 'gemini' | 'keyword'; intent?: string };
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
      intentSource: 'keyword' as const,
      insightsLlmExplain,
    };

    // ─── محاولة فهم النية عبر Gemini (إن توفر المفتاح) ───
    if (this.geminiService.isAvailable()) {
      try {
        const parsed = await this.geminiService.parseIntent(query);
        if (parsed && parsed.intent !== 'unknown') {
          const geminiCtx = {
            ...baseCtx,
            intentSource: 'gemini' as const,
            parsedIntent: parsed.intent,
          };
          for (const handler of CHAT_HANDLERS) {
            if (handler.matchesIntent?.(parsed.intent, can)) {
              const result = await handler.process(geminiCtx);
              if (result) return { ...result, meta: { intentSource: 'gemini', intent: parsed.intent } };
            }
          }
        }
      } catch {
        // fallback إلى الكلمات المفتاحية
      }
    }

    // ─── مطابقة الكلمات المفتاحية (fallback أو عند عدم توفر Gemini) ───
    for (const handler of CHAT_HANDLERS) {
      if (handler.canHandle(q, can)) {
        const result = await handler.process(baseCtx);
        if (result) return { ...result, meta: { intentSource: 'keyword' } };
      }
    }

    // ─── إجابة عامة عبر Gemini (للأسئلة خارج النظام) — عند تفعيل GEMINI_OPEN_MODE ───
    if (this.geminiService.isAvailable() && isGeminiOpenModeEnabled()) {
      try {
        const general = await this.geminiService.answerGeneral(query);
        if (general) return { ...general, meta: { intentSource: 'gemini', intent: 'general' } };
      } catch {
        // fallback للرد الافتراضي
      }
    }

    return {
      answerAr: 'لم أفهم سؤالك. جرّب صياغة أخرى أو اكتب "مساعدة" لرؤية الأسئلة المدعومة.',
      answerEn: 'I did not understand your question. Try rephrasing or type "help" to see supported questions.',
      meta: { intentSource: 'keyword' },
    };
  }
}
