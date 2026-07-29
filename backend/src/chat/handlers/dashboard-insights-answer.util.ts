import type { InsightItem } from '../../reporting/insights/insights.types';
import type {
  CombinedInsightWarning,
  ExtendedReportingInsightsPayload,
} from '../../reporting/insights/reporting-insights-aggregator.types';
import {
  formatInsightsPeriodLabelAr,
  formatInsightsPeriodLabelEn,
} from './dashboard-insights-period.util';
import {
  type DashboardInsightsFocus,
  filterMergedByFocus,
} from './dashboard-insights-focus.util';
import {
  buildMoneyOverviewAnswer,
  expenseCategoryTable,
  purchaseCategoryTable,
} from './dashboard-insights-money-answer.util';

export const MSG_NO_ALERT_AR = `لا توجد تنبيهات مالية حالياً.
الأرقام الحالية لا تتجاوز حدود التحذير المحددة لهذه الشركة.`;

export const MSG_NO_ALERT_EN = `No financial alerts right now.
Current figures do not exceed this company's configured warning thresholds.`;

export const MSG_NO_REPORTS_AR =
  'لعرض مؤشرات الحالة المالية يلزم صلاحية عرض التقارير. تواصل مع المسؤول.';
export const MSG_NO_REPORTS_EN =
  'You need permission to view reports to see financial insights. Contact your administrator.';

function msgNoFocusAreaAr(focus: DashboardInsightsFocus): string {
  switch (focus) {
    case 'purchases':
      return 'لا توجد تنبيهات محددة في مجال المشتريات ضمن الفترة المعروضة.';
    case 'expenses':
      return 'لا توجد تنبيهات محددة في مجال المصروفات ضمن الفترة المعروضة.';
    case 'profitability':
      return 'لا توجد تنبيهات محددة في مجال الربحية ضمن الفترة المعروضة.';
    case 'alerts':
      return 'لا توجد تنبيهات متابعة بارزة ضمن الفترة المعروضة.';
    default:
      return MSG_NO_ALERT_AR;
  }
}

function msgNoFocusAreaEn(focus: DashboardInsightsFocus): string {
  switch (focus) {
    case 'purchases':
      return 'No purchase-specific alerts for the selected period.';
    case 'expenses':
      return 'No expense-specific alerts for the selected period.';
    case 'profitability':
      return 'No profitability-specific alerts for the selected period.';
    case 'alerts':
      return 'No notable alerts to follow up on for the selected period.';
    default:
      return MSG_NO_ALERT_EN;
  }
}

function sourcePrefixAr(w: InsightItem & { source?: string }): string {
  if (w.source === 'purchases') return '[مشتريات] ';
  if (w.source === 'expenses') return '[مصاريف] ';
  if (w.source === 'dashboard') return '[لوحة] ';
  return '';
}

function sourcePrefixEn(w: InsightItem & { source?: string }): string {
  if (w.source === 'purchases') return '[Purchases] ';
  if (w.source === 'expenses') return '[Expenses] ';
  if (w.source === 'dashboard') return '[Dashboard] ';
  return '';
}

function formatLinesAr(items: Array<InsightItem & { source?: string }>): string {
  return items
    .map((w) => {
      const p = sourcePrefixAr(w);
      const d = w.detailAr?.trim();
      return d ? `• ${p}${w.titleAr}\n  ${d}` : `• ${p}${w.titleAr}`;
    })
    .join('\n');
}

function formatLinesEn(items: Array<InsightItem & { source?: string }>): string {
  return items
    .map((w) => {
      const p = sourcePrefixEn(w);
      const d = w.detailEn?.trim();
      return d ? `• ${p}${w.titleEn}\n  ${d}` : `• ${p}${w.titleEn}`;
    })
    .join('\n');
}

function countBySeverity(merged: CombinedInsightWarning[]): { critical: number; warning: number; info: number } {
  const o = { critical: 0, warning: 0, info: 0 };
  for (const w of merged) {
    if (w.severity === 'critical') o.critical += 1;
    else if (w.severity === 'warning') o.warning += 1;
    else o.info += 1;
  }
  return o;
}

function formatSourcesAr(merged: CombinedInsightWarning[]): string {
  const s = new Set(merged.map((w) => w.source));
  const parts: string[] = [];
  if (s.has('dashboard')) parts.push('لوحة');
  if (s.has('purchases')) parts.push('مشتريات');
  if (s.has('expenses')) parts.push('مصاريف');
  return parts.join('، ');
}

function formatSourcesEn(merged: CombinedInsightWarning[]): string {
  const s = new Set(merged.map((w) => w.source));
  const parts: string[] = [];
  if (s.has('dashboard')) parts.push('dashboard');
  if (s.has('purchases')) parts.push('purchases');
  if (s.has('expenses')) parts.push('expenses');
  return parts.join(', ');
}

/** ملخص مضغوط بعد النقاط — بدون JSON خام. */
function formatCompactSummaryAr(merged: CombinedInsightWarning[]): string | null {
  if (merged.length === 0) return null;
  const c = countBySeverity(merged);
  const parts: string[] = [];
  if (c.critical) parts.push(`${c.critical} حرج`);
  if (c.warning) parts.push(`${c.warning} تحذير`);
  if (c.info) parts.push(`${c.info} معلومات`);
  const critTitles = merged.filter((w) => w.severity === 'critical').slice(0, 2).map((w) => w.titleAr);
  const topLine =
    critTitles.length > 0 ? `أبرز التنبيهات: ${critTitles.join('؛ ')}.` : '';
  return [
    `ملخص التنبيهات: ${merged.length} إجمالي (${parts.join('، ')}). المصادر: ${formatSourcesAr(merged)}.`,
    topLine,
  ]
    .filter(Boolean)
    .join(' ');
}

function formatCompactSummaryEn(merged: CombinedInsightWarning[]): string | null {
  if (merged.length === 0) return null;
  const c = countBySeverity(merged);
  const parts: string[] = [];
  if (c.critical) parts.push(`${c.critical} critical`);
  if (c.warning) parts.push(`${c.warning} warning(s)`);
  if (c.info) parts.push(`${c.info} info`);
  const critTitles = merged.filter((w) => w.severity === 'critical').slice(0, 2).map((w) => w.titleEn);
  const topLine =
    critTitles.length > 0 ? `Top alerts: ${critTitles.join('; ')}.` : '';
  return [
    `Alert overview: ${merged.length} total (${parts.join(', ')}). Sources: ${formatSourcesEn(merged)}.`,
    topLine,
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildAnswer(
  focus: DashboardInsightsFocus,
  extended: ExtendedReportingInsightsPayload,
  year: number,
  selectedMonth: number,
): { answerAr: string; answerEn: string } {
  const payload = extended.dashboardInsights;
  const healthAr = payload.health.summaryAr;
  const healthEn = payload.health.summaryEn;
  const merged = extended.warnings;

  if (focus === 'overview') {
    return buildMoneyOverviewAnswer(extended, merged, year, selectedMonth, {
      noAlertAr: MSG_NO_ALERT_AR,
      noAlertEn: MSG_NO_ALERT_EN,
    });
  }

  const purchaseTable = focus === 'purchases' ? purchaseCategoryTable(extended, merged) : null;
  const expenseTable = focus === 'expenses' ? expenseCategoryTable(extended, merged) : null;

  const pool = filterMergedByFocus(focus, merged);
  const maxPick = focus === 'alerts' ? 5 : 8;
  const picked = pool.slice(0, maxPick);
  const compactAr = formatCompactSummaryAr(merged);
  const compactEn = formatCompactSummaryEn(merged);
  if (picked.length === 0) {
    const periodAr = formatInsightsPeriodLabelAr(year, selectedMonth);
    const periodEn = formatInsightsPeriodLabelEn(year, selectedMonth);
    const baseAr: string[] = [periodAr, '', healthAr];
    if (purchaseTable) {
      baseAr.push('', 'مشتريات حسب الفئة (فترة الفواتير)', ...purchaseTable.linesAr);
    }
    if (expenseTable) {
      baseAr.push('', 'مصاريف حسب الفئة (دفتر الشهر)', ...expenseTable.linesAr);
    }
    baseAr.push('', msgNoFocusAreaAr(focus));
    const baseEn: string[] = [periodEn, '', healthEn];
    if (purchaseTable) {
      baseEn.push('', 'Purchases by category (invoice period)', ...purchaseTable.linesEn);
    }
    if (expenseTable) {
      baseEn.push('', 'Expenses by category (month ledger)', ...expenseTable.linesEn);
    }
    baseEn.push('', msgNoFocusAreaEn(focus));
    if (compactAr) baseAr.push('', compactAr);
    if (compactEn) baseEn.push('', compactEn);
    return { answerAr: baseAr.join('\n'), answerEn: baseEn.join('\n') };
  }
  const partsAr: string[] = [healthAr];
  if (purchaseTable) {
    partsAr.push('', 'مشتريات حسب الفئة (فترة الفواتير)', ...purchaseTable.linesAr);
  }
  if (expenseTable) {
    partsAr.push('', 'مصاريف حسب الفئة (دفتر الشهر)', ...expenseTable.linesAr);
  }
  partsAr.push('', formatLinesAr(picked));
  const partsEn: string[] = [healthEn];
  if (purchaseTable) {
    partsEn.push('', 'Purchases by category (invoice period)', ...purchaseTable.linesEn);
  }
  if (expenseTable) {
    partsEn.push('', 'Expenses by category (month ledger)', ...expenseTable.linesEn);
  }
  partsEn.push('', formatLinesEn(picked));
  if (compactAr) partsAr.push('', compactAr);
  if (compactEn) partsEn.push('', compactEn);
  return { answerAr: partsAr.join('\n'), answerEn: partsEn.join('\n') };
}

/** Exported for unit tests — deterministic Smart Chat body for dashboard_insights. */
export function buildDashboardInsightsDeterministicAnswer(
  focus: DashboardInsightsFocus,
  extended: ExtendedReportingInsightsPayload,
  year: number,
  selectedMonth: number,
): { answerAr: string; answerEn: string } {
  return buildAnswer(focus, extended, year, selectedMonth);
}

/** لاختبارات الوحدة — حزمة JSON آمنة لشرح LLM فقط (لوحة فقط). */
