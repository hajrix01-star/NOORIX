import type { DashboardInsightsPayload, InsightItem } from '../../reporting/insights/insights.types';
import type {
  CombinedInsightWarning,
  ExtendedReportingInsightsPayload,
} from '../../reporting/insights/reporting-insights-aggregator.types';
import {
  type DashboardInsightsFocus,
  type DashboardInsightsQueryKind,
  filterMergedByFocus,
  filterWarnings,
  focusToDashKind,
} from './dashboard-insights-focus.util';
import {
  formatInsightsPeriodLabelAr,
  formatInsightsPeriodLabelEn,
} from './dashboard-insights-period.util';

function countWarningsBySeverity(merged: CombinedInsightWarning[]): { critical: number; warning: number; info: number } {
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const warning of merged) {
    if (warning.severity === 'critical') counts.critical += 1;
    else if (warning.severity === 'warning') counts.warning += 1;
    else counts.info += 1;
  }
  return counts;
}

function mapDashboardInsightItem(item: InsightItem) {
  return {
    id: item.id,
    severity: item.severity,
    category: item.category,
    metricBasis: item.metricBasis,
    titleAr: item.titleAr,
    detailAr: item.detailAr,
    titleEn: item.titleEn,
    detailEn: item.detailEn,
    values: item.values,
  };
}

function mapMergedInsightItem(item: CombinedInsightWarning) {
  return {
    id: item.id,
    severity: item.severity,
    category: item.category,
    metricBasis: item.metricBasis,
    titleAr: item.titleAr,
    detailAr: item.detailAr,
    titleEn: item.titleEn,
    detailEn: item.detailEn,
    values: item.values,
    source: item.source,
  };
}

export function buildInsightsExplanationPackage(
  payload: DashboardInsightsPayload,
  kind: DashboardInsightsQueryKind,
  year: number,
  selectedMonth: number,
): Record<string, unknown> {
  const warningsForPack =
    kind === 'general' ? payload.warnings.slice(0, 25) : filterWarnings(kind, payload.warnings);

  return {
    periodLabel: {
      ar: formatInsightsPeriodLabelAr(year, selectedMonth),
      en: formatInsightsPeriodLabelEn(year, selectedMonth),
    },
    health: {
      summaryAr: payload.health.summaryAr,
      summaryEn: payload.health.summaryEn,
      band: payload.health.band,
      score: payload.health.score,
    },
    warnings: warningsForPack.map(mapDashboardInsightItem),
    insights: payload.insights.slice(0, 25).map(mapDashboardInsightItem),
    ratios: payload.ratios,
    metrics: payload.metrics,
  };
}

export function buildExtendedInsightsExplanationPackage(
  extended: ExtendedReportingInsightsPayload,
  focus: DashboardInsightsFocus,
  year: number,
  selectedMonth: number,
): Record<string, unknown> {
  const dash = extended.dashboardInsights;
  const dashKind = focusToDashKind(focus);
  const base = buildInsightsExplanationPackage(dash, dashKind, year, selectedMonth);
  const mergedForPack =
    focus === 'overview'
      ? extended.warnings.slice(0, 25)
      : filterMergedByFocus(focus, extended.warnings).slice(0, 25);
  const counts = countWarningsBySeverity(extended.warnings);

  return {
    ...base,
    warnings: mergedForPack.map(mapMergedInsightItem),
    mergedOverview: {
      total: extended.warnings.length,
      critical: counts.critical,
      warning: counts.warning,
      info: counts.info,
      sourcesPresent: [...new Set(extended.warnings.map((warning) => warning.source))],
      focus,
    },
    purchaseSupplierWarningCount: extended.purchaseSupplierInsights.warnings.length,
    expenseWarningCount: extended.expenseInsights.warnings.length,
  };
}

export function queryLooksArabic(query: string): boolean {
  return /[\u0600-\u06FF]/.test(query);
}

function insightsLlmContainsUngroundedLargeNumber(text: string, packStr: string): boolean {
  const nums = text.match(/\b\d{4,}(?:[.,]\d+)?\b/g);
  if (!nums) return false;
  const flatPack = packStr.replace(/\s+/g, '');

  for (const num of nums) {
    const candidates = [num, num.replace(/,/g, ''), num.replace(/\./g, ',')];
    if (candidates.some((candidate) => flatPack.includes(candidate.replace(/\s+/g, '')))) continue;
    return true;
  }

  return false;
}

export function validateInsightsLlmAnswer(llm: { answerAr: string; answerEn: string }, packStr: string): boolean {
  const answerAr = String(llm.answerAr || '').trim();
  const answerEn = String(llm.answerEn || '').trim();
  if (answerAr.length < 8 || answerEn.length < 8) return false;

  const maxAnswerLength = 1100;
  if (answerAr.length > maxAnswerLength || answerEn.length > maxAnswerLength || answerAr.length + answerEn.length > 2000) {
    return false;
  }
  if (/{/.test(answerAr) || /{/.test(answerEn)) return false;
  if (insightsLlmContainsUngroundedLargeNumber(`${answerAr}\n${answerEn}`, packStr)) return false;

  return true;
}
