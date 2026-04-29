/**
 * ردود حتمية من رؤى لوحة التحكم — مصدر الحقيقة {@link DashboardInsightsService}.
 */
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { DashboardSummaryDateRange } from '../../reporting/reporting.facade';
import type { InsightItem } from '../../reporting/insights/insights.types';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';

const PURCHASE_INSIGHT_IDS = new Set(['purchase_ratio_to_sales', 'unusually_high_purchases_warning']);
const PROFIT_INSIGHT_IDS = new Set(['net_profit_margin', 'negative_profit_warning']);

const MSG_NEUTRAL_AR =
  'لا توجد تنبيهات مالية واضحة حالياً حسب حدود التحليل الحالية.';
const MSG_NEUTRAL_EN = 'No clear financial alerts based on the current insight thresholds.';

const MSG_NO_REPORTS_AR =
  'لعرض مؤشرات الحالة المالية يلزم صلاحية عرض التقارير. تواصل مع المسؤول.';
const MSG_NO_REPORTS_EN =
  'You need permission to view reports to see financial insights. Contact your administrator.';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** يطابق بناء فترة لوحة التحكم لشهر تقويمي واحد (بدون حسابات مالية جديدة). */
export function buildDashboardInsightsDateRangeForMonth(
  year: number,
  selectedMonth: number,
): DashboardSummaryDateRange {
  const last = new Date(year, selectedMonth, 0).getDate();
  const monthStart = `${year}-${pad2(selectedMonth)}-01`;
  const monthEnd = `${year}-${pad2(selectedMonth)}-${pad2(last)}`;
  return {
    year,
    yearStart: `${year}-01-01`,
    yearEnd: `${year}-12-31`,
    dailyStart: null,
    dailyEnd: null,
    monthStart,
    monthEnd,
    periodStart: monthStart,
    periodEnd: monthEnd,
  };
}

/** شهر تقويمي للتحليل من parsePeriod أو الشهر الحالي. */
export function resolveInsightsYearMonth(ctx: ChatHandlerContext): {
  year: number;
  selectedMonth: number;
} {
  if (ctx.period) {
    const start = ctx.period.start;
    return { year: start.getFullYear(), selectedMonth: start.getMonth() + 1 };
  }
  return { year: ctx.now.getFullYear(), selectedMonth: ctx.now.getMonth() + 1 };
}

export type DashboardInsightsQueryKind = 'general' | 'purchases' | 'profit' | null;

export function classifyDashboardInsightsQuery(q: string): DashboardInsightsQueryKind {
  if (
    matches(q, [
      'هل المشتريات مرتفعة',
      'مشتريات مرتفعة',
      'are purchases high',
      'purchases high',
    ])
  ) {
    return 'purchases';
  }
  if (matches(q, ['هل الربح جيد', 'الربح جيد', 'is profit good', 'profit good'])) {
    return 'profit';
  }
  if (
    matches(q, [
      'كيف وضع الشهر',
      'وضع الشهر',
      'ملخص الشهر',
      'اعطني ملخص الشهر',
      'how is the month',
      'monthly summary',
      'month status',
    ]) ||
    (matches(q, ['ملخص']) && matches(q, ['شهر']))
  ) {
    return 'general';
  }
  return null;
}

function filterWarnings(kind: DashboardInsightsQueryKind, warnings: InsightItem[]): InsightItem[] {
  if (kind === 'purchases') {
    return warnings.filter((w) => PURCHASE_INSIGHT_IDS.has(w.id));
  }
  if (kind === 'profit') {
    return warnings.filter((w) => PROFIT_INSIGHT_IDS.has(w.id));
  }
  return warnings;
}

function formatLinesAr(items: InsightItem[]): string {
  return items
    .map((w) => {
      const d = w.detailAr?.trim();
      return d ? `• ${w.titleAr}\n  ${d}` : `• ${w.titleAr}`;
    })
    .join('\n');
}

function formatLinesEn(items: InsightItem[]): string {
  return items
    .map((w) => {
      const d = w.detailEn?.trim();
      return d ? `• ${w.titleEn}\n  ${d}` : `• ${w.titleEn}`;
    })
    .join('\n');
}

function buildAnswer(
  kind: DashboardInsightsQueryKind,
  healthAr: string,
  healthEn: string,
  warnings: InsightItem[],
): { answerAr: string; answerEn: string } {
  const picked = kind === 'general' ? warnings.slice(0, 3) : filterWarnings(kind, warnings);
  if (picked.length === 0) {
    return {
      answerAr: [healthAr, '', MSG_NEUTRAL_AR].join('\n'),
      answerEn: [healthEn, '', MSG_NEUTRAL_EN].join('\n'),
    };
  }
  return {
    answerAr: [healthAr, '', formatLinesAr(picked)].join('\n'),
    answerEn: [healthEn, '', formatLinesEn(picked)].join('\n'),
  };
}

export const dashboardInsightsHandler: ChatHandler = {
  priority: 5,
  intent: 'dashboard_insights',
  matchesIntent: (intent, can) =>
    intent === 'dashboard_insights' && can(PERMISSIONS.REPORTS_READ) && can(PERMISSIONS.SMART_CHAT_READ),
  canHandle: (q) => classifyDashboardInsightsQuery(q) != null,
  process: async (ctx) => {
    const kind = classifyDashboardInsightsQuery(ctx.query);
    if (kind == null) return null;

    if (!ctx.can(PERMISSIONS.REPORTS_READ)) {
      return { answerAr: MSG_NO_REPORTS_AR, answerEn: MSG_NO_REPORTS_EN };
    }

    const { year, selectedMonth } = resolveInsightsYearMonth(ctx);
    const dateRange = buildDashboardInsightsDateRangeForMonth(year, selectedMonth);
    const payload = await ctx.dashboardInsightsService.buildDashboardInsights(
      ctx.companyId,
      dateRange,
      selectedMonth,
      ctx.now,
    );

    const { answerAr, answerEn } = buildAnswer(kind, payload.health.summaryAr, payload.health.summaryEn, payload.warnings);
    return { answerAr, answerEn };
  },
};
