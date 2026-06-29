import type { InsightItem } from '../../reporting/insights/insights.types';
import type { CombinedInsightWarning } from '../../reporting/insights/reporting-insights-aggregator.types';
import { parseDashboardInsightsMonth } from './dashboard-insights-period.util';
import { matches } from './utils';

const PURCHASE_INSIGHT_IDS = new Set(['purchase_ratio_to_sales', 'unusually_high_purchases_warning']);
const PROFIT_INSIGHT_IDS = new Set(['net_profit_margin', 'negative_profit_warning']);
const EXPENSE_INSIGHT_IDS = new Set(['expense_ratio_to_sales']);
export type DashboardInsightsQueryKind = 'general' | 'purchases' | 'profit' | null;

/** مجال تركيز السؤال — نفس النية dashboard_insights، عرض فقط. */
export type DashboardInsightsFocus =
  | 'overview'
  | 'purchases'
  | 'expenses'
  | 'profitability'
  | 'alerts';

/**
 * يحدد تركيز السؤال من الصياغة (عربي/إنجليزي) — ترتيب الأولوية: تنبيهات ← مصاريف ← مشتريات ← ربحية.
 * لا يستبدل النية ولا يستدعي خدمات.
 */
export function resolveDashboardInsightsFocus(q: string): DashboardInsightsFocus {
  const lower = q.toLowerCase();
  if (
    matches(q, [
      'حلل الوضع المالي',
      'كيف الوضع المالي',
      'تقرير مالي مختصر',
      'ملخص مالي',
    ]) ||
    /\bfinancial overview\b/i.test(lower) ||
    /\bfinancial health\b/i.test(lower) ||
    /\bbusiness health\b/i.test(lower)
  ) {
    return 'overview';
  }
  if (
    matches(q, [
      'وش أهم التنبيهات',
      'وش اهم التنبيهات',
      'وش التنبيهات',
      'اهم التنبيهات',
      'أهم التنبيهات',
      'تنبيهات مهمة',
      'التنبيهات المالية',
      'financial alerts',
      'main alerts',
    ]) ||
    /\balerts\b/i.test(lower) ||
    /\bwarnings\b/i.test(lower)
  ) {
    return 'alerts';
  }
  if (
    matches(q, [
      'حلل المصاريف',
      'تحليل المصاريف',
      'تحليل مصاريف',
      'expense analysis',
      'analyze expenses',
      'هل المصاريف مرتفعة',
      'مصاريف مرتفعة',
    ])
  ) {
    return 'expenses';
  }
  if (
    matches(q, [
      'حلل المشتريات',
      'تحليل المشتريات',
      'تحليل مشتريات',
      'purchase analysis',
      'analyze purchases',
      'هل المشتريات مرتفعة',
      'مشتريات مرتفعة',
      'are purchases high',
      'purchases high',
    ])
  ) {
    return 'purchases';
  }
  if (
    matches(q, [
      'هل الربحية',
      'ربحية سيئة',
      'عائد ربحي',
      'profit margin',
      'net profit',
      'profitability',
      'هل الربح جيد',
      'الربح جيد',
      'is profit good',
      'profit good',
      'هامش الربح',
      'هامش ربح',
    ])
  ) {
    return 'profitability';
  }
  return 'overview';
}

/** يدمج تركيز الكلمات مع تصنيف السؤال القديم (مشتريات/ربح). */
export function resolveEffectiveDashboardInsightsFocus(
  q: string,
  kind: DashboardInsightsQueryKind,
): DashboardInsightsFocus {
  const fromPhrase = resolveDashboardInsightsFocus(q);
  if (fromPhrase !== 'overview') return fromPhrase;
  if (kind === 'purchases') return 'purchases';
  if (kind === 'profit') return 'profitability';
  return 'overview';
}

export function focusToDashKind(focus: DashboardInsightsFocus): DashboardInsightsQueryKind {
  if (focus === 'purchases') return 'purchases';
  if (focus === 'profitability') return 'profit';
  return 'general';
}

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

  if (
    matches(q, [
      'حلل الوضع المالي',
      'كيف الوضع المالي',
      'تقرير مالي مختصر',
      'ملخص مالي',
    ])
  ) {
    return 'general';
  }

  const lower = q.toLowerCase();
  if (
    /\bfinancial overview\b/i.test(lower) ||
    /\bfinancial health\b/i.test(lower) ||
    /\bbusiness health\b/i.test(lower)
  ) {
    return 'general';
  }
  if (
    matches(q, [
      'حلل المشتريات',
      'تحليل المشتريات',
      'purchase analysis',
      'analyze purchases',
      'حلل المصاريف',
      'تحليل المصاريف',
      'expense analysis',
      'analyze expenses',
      'هل الربحية',
      'ربحية سيئة',
      'profit margin',
      'net profit',
      'profitability',
      'وش أهم التنبيهات',
      'وش اهم التنبيهات',
      'اهم التنبيهات',
      'أهم التنبيهات',
      'تنبيهات مهمة',
    ]) ||
    /\balerts\b/i.test(lower) ||
    /\bwarnings\b/i.test(lower)
  ) {
    return 'general';
  }

  const explicitMonth = parseDashboardInsightsMonth(q, new Date());
  if (explicitMonth !== null) {
    if (
      matches(q, [
        'كيف وضع',
        'وضع الشهر',
        'ملخص الشهر',
        'اعطني ملخص الشهر',
        'how is',
        "how's",
        'monthly summary',
        'month status',
      ]) ||
      (matches(q, ['ملخص']) && matches(q, ['شهر']))
    ) {
      return 'general';
    }
  }

  return null;
}

export function filterWarnings(kind: DashboardInsightsQueryKind, warnings: InsightItem[]): InsightItem[] {
  if (kind === 'purchases') {
    return warnings.filter((w) => PURCHASE_INSIGHT_IDS.has(w.id));
  }
  if (kind === 'profit') {
    return warnings.filter((w) => PROFIT_INSIGHT_IDS.has(w.id));
  }
  return warnings;
}

export function filterMergedByFocus(focus: DashboardInsightsFocus, merged: CombinedInsightWarning[]): CombinedInsightWarning[] {
  if (focus === 'overview') return merged;
  if (focus === 'purchases') {
    return merged.filter((w) => w.source === 'purchases' || PURCHASE_INSIGHT_IDS.has(w.id));
  }
  if (focus === 'expenses') {
    return merged.filter(
      (w) => w.source === 'expenses' || EXPENSE_INSIGHT_IDS.has(w.id) || w.category === 'expenses',
    );
  }
  if (focus === 'profitability') {
    return merged.filter((w) => PROFIT_INSIGHT_IDS.has(w.id) || w.category === 'profit');
  }
  if (focus === 'alerts') {
    const serious = merged.filter((w) => w.severity === 'critical' || w.severity === 'warning');
    return serious.length > 0 ? serious : merged;
  }
  return merged;
}


