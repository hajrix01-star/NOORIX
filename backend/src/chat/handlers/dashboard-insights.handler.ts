/**
 * ردود حتمية من رؤى لوحة التحكم — مصدر البيانات {@link ReportingInsightsAggregatorService.getExtendedInsights}
 * (يضم {@link DashboardInsightsService} وخدمات المشتريات/المصاريف دون تغيير حساباتها).
 */
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler } from './types';
import {
  buildDashboardInsightsDateRangeForMonth,
  formatInsightsPeriodLabelAr,
  formatInsightsPeriodLabelEn,
  parseDashboardInsightsMonth,
  resolveInsightsYearMonth,
} from './dashboard-insights-period.util';
import {
  classifyDashboardInsightsQuery,
  filterMergedByFocus,
  resolveDashboardInsightsFocus,
  resolveEffectiveDashboardInsightsFocus,
} from './dashboard-insights-focus.util';
import {
  MSG_NO_REPORTS_AR,
  MSG_NO_REPORTS_EN,
  buildAnswer,
  buildExtendedInsightsExplanationPackage,
  queryLooksArabic,
  validateInsightsLlmAnswer,
} from './dashboard-insights-answer.util';

export {
  buildDashboardInsightsDateRangeForMonth,
  formatInsightsPeriodLabelAr,
  formatInsightsPeriodLabelEn,
  parseDashboardInsightsMonth,
  resolveInsightsYearMonth,
} from './dashboard-insights-period.util';
export {
  classifyDashboardInsightsQuery,
  resolveDashboardInsightsFocus,
  resolveEffectiveDashboardInsightsFocus,
} from './dashboard-insights-focus.util';

export {
  buildDashboardInsightsDeterministicAnswer,
  buildExtendedInsightsExplanationPackage,
  buildInsightsExplanationPackage,
  validateInsightsLlmAnswer,
} from './dashboard-insights-answer.util';
export const dashboardInsightsHandler: ChatHandler = {
  priority: 5,
  intent: 'dashboard_insights',
  matchesIntent: (intent, can) =>
    intent === 'dashboard_insights' && can(PERMISSIONS.REPORTS_READ) && can(PERMISSIONS.SMART_CHAT_READ),
  canHandle: (q) => classifyDashboardInsightsQuery(q) != null,
  process: async (ctx) => {
    let kind = classifyDashboardInsightsQuery(ctx.query);
    if (kind == null && ctx.intentSource === 'gemini' && ctx.parsedIntent === 'dashboard_insights') {
      kind = 'general';
    }
    if (kind == null) return null;

    if (!ctx.can(PERMISSIONS.REPORTS_READ)) {
      return { answerAr: MSG_NO_REPORTS_AR, answerEn: MSG_NO_REPORTS_EN };
    }

    const { year, selectedMonth } = resolveInsightsYearMonth(ctx);
    const dateRange = buildDashboardInsightsDateRangeForMonth(year, selectedMonth);
    const extended = await ctx.reportingInsightsAggregatorService.getExtendedInsights(
      ctx.companyId,
      dateRange,
      selectedMonth,
      ctx.now,
    );
    const effectiveFocus = resolveEffectiveDashboardInsightsFocus(ctx.query, kind);

    let { answerAr, answerEn } = buildAnswer(effectiveFocus, extended, year, selectedMonth);

    const poolLlm = filterMergedByFocus(effectiveFocus, extended.warnings);
    const maxLlmPick = effectiveFocus === 'overview' ? 3 : 5;
    const pickedForLlm = poolLlm.slice(0, maxLlmPick);

    if (ctx.insightsLlmExplain && pickedForLlm.length > 0) {
      try {
        const explanationPack = buildExtendedInsightsExplanationPackage(extended, effectiveFocus, year, selectedMonth);
        const packStr = JSON.stringify(explanationPack);
        const llmOut = await ctx.insightsLlmExplain(ctx.query, explanationPack, {
          prefersArabic: queryLooksArabic(ctx.query),
        });
        if (llmOut && validateInsightsLlmAnswer(llmOut, packStr)) {
          answerAr = llmOut.answerAr;
          answerEn = llmOut.answerEn;
        }
      } catch {
        /* الرد الحتمي */
      }
    }

    return { answerAr, answerEn };
  },
};
