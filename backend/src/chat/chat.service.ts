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
import { PERMISSIONS, hasPermission } from '../auth/constants/permissions';
import { CHAT_HANDLERS } from './handlers';
import { normalizeQuery, parsePeriod } from './handlers/utils';
import { GeminiService } from './gemini.service';
import { isGeminiOpenModeEnabled } from '../config/gemini.config';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly reportsService: ReportsService,
    private readonly vaultsService: VaultsService,
    private readonly geminiService: GeminiService,
  ) {}

  async processQuery(
    companyId: string,
    query: string,
    userRole: string,
  ): Promise<{ answerAr: string; answerEn: string; meta?: { intentSource: 'gemini' | 'keyword'; intent?: string } }> {
    const q = normalizeQuery(query);
    const can = (p: string) => hasPermission(userRole, p as any);

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

    const ctx = {
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
    };

    // ─── محاولة فهم النية عبر Gemini (إن توفر المفتاح) ───
    if (this.geminiService.isAvailable()) {
      try {
        const parsed = await this.geminiService.parseIntent(query);
        if (parsed && parsed.intent !== 'unknown') {
          for (const handler of CHAT_HANDLERS) {
            if (handler.matchesIntent?.(parsed.intent, can)) {
              const result = await handler.process(ctx);
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
        const result = await handler.process(ctx);
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
