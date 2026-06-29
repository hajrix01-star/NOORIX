import type { DashboardInsightsPayload, InsightItem } from '../../reporting/insights/insights.types';
import { formatInsightPercentFraction } from '../../reporting/insights/insights.rules';
import { INSIGHT_THRESHOLDS } from '../../reporting/insights/insights.thresholds';
import type { PurchaseCategoryBreakdownRow } from '../../reporting/insights/purchases/purchase-supplier-insights.rules';
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
  type DashboardInsightsQueryKind,
  filterMergedByFocus,
  filterWarnings,
  focusToDashKind,
} from './dashboard-insights-focus.util';

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

function accountingCellPresent(v: string | number | null | undefined): boolean {
  if (v === null || v === undefined) return false;
  return String(v).trim() !== '';
}

function parseInvoiceAmountStr(s: string): number {
  const n = parseFloat(String(s ?? '0').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function purchaseRowStatusAr(row: PurchaseCategoryBreakdownRow, merged: CombinedInsightWarning[]): string {
  for (const w of merged) {
    const v = w.values as Record<string, unknown> | undefined;
    if (!v) continue;
    if (w.id === 'purchase_category_concentration_warning' && String(v.topCategoryId ?? '') === String(row.categoryId ?? '')) {
      return w.severity === 'critical' ? 'حرج' : 'تحذير';
    }
    if (w.id === 'purchase_uncategorized_share_warning' && row.categoryId == null) {
      return w.severity === 'critical' ? 'حرج' : 'تحذير';
    }
    if (w.id === 'purchase_category_spike_warning' && String(v.categoryId ?? '') === String(row.categoryId ?? '')) {
      return w.severity === 'critical' ? 'حرج' : 'تحذير';
    }
  }
  return '—';
}

function purchaseRowStatusEn(row: PurchaseCategoryBreakdownRow, merged: CombinedInsightWarning[]): string {
  for (const w of merged) {
    const v = w.values as Record<string, unknown> | undefined;
    if (!v) continue;
    if (w.id === 'purchase_category_concentration_warning' && String(v.topCategoryId ?? '') === String(row.categoryId ?? '')) {
      return w.severity === 'critical' ? 'Critical' : 'Warning';
    }
    if (w.id === 'purchase_uncategorized_share_warning' && row.categoryId == null) {
      return w.severity === 'critical' ? 'Critical' : 'Warning';
    }
    if (w.id === 'purchase_category_spike_warning' && String(v.categoryId ?? '') === String(row.categoryId ?? '')) {
      return w.severity === 'critical' ? 'Critical' : 'Warning';
    }
  }
  return '—';
}

function expenseRowStatusAr(rowKey: string, merged: CombinedInsightWarning[]): string {
  const catId = rowKey.startsWith('category:') ? rowKey.slice('category:'.length) : null;
  for (const w of merged) {
    const v = w.values as Record<string, unknown> | undefined;
    if (!v) continue;
    if (w.id === 'top_expense_category_share_warning' && catId && String(v.categoryId ?? '') === catId) {
      return w.severity === 'critical' ? 'حرج' : 'تحذير';
    }
    if (w.id === 'missing_expense_category_warning' && rowKey === 'uncategorized:expense') {
      return w.severity === 'critical' ? 'حرج' : 'تحذير';
    }
  }
  return '—';
}

function expenseRowStatusEn(rowKey: string, merged: CombinedInsightWarning[]): string {
  const catId = rowKey.startsWith('category:') ? rowKey.slice('category:'.length) : null;
  for (const w of merged) {
    const v = w.values as Record<string, unknown> | undefined;
    if (!v) continue;
    if (w.id === 'top_expense_category_share_warning' && catId && String(v.categoryId ?? '') === catId) {
      return w.severity === 'critical' ? 'Critical' : 'Warning';
    }
    if (w.id === 'missing_expense_category_warning' && rowKey === 'uncategorized:expense') {
      return w.severity === 'critical' ? 'Critical' : 'Warning';
    }
  }
  return '—';
}

function overviewRecommendationsAr(band: DashboardInsightsPayload['health']['band']): string[] {
  const out: string[] = [];
  if (band === 'red') {
    out.push('أولوية لهذا الشهر: معالجة أسباب التنبيهات الحرجة قبل زيادة الالتزامات أو الاستثمار.');
  } else if (band === 'amber') {
    out.push('راجع بنود التحذير أعلاه وتحقق من اكتمال التصنيف في المشتريات والمصاريف.');
  } else if (band === 'green') {
    out.push('تابع القراءة الشهرية لنفس المؤشرات للإبقاء على المسار الحالي.');
  }
  if (out.length < 2) {
    out.push('استخدم تقارير التفصيل في النظام عند الحاجة لمقارنة هذا الشهر بأشهر سابقة.');
  }
  return out.slice(0, 2);
}

function overviewRecommendationsEn(band: DashboardInsightsPayload['health']['band']): string[] {
  const out: string[] = [];
  if (band === 'red') {
    out.push('Priority this month: address critical alert drivers before increasing commitments or investment.');
  } else if (band === 'amber') {
    out.push('Review the warning items above and confirm purchase/expense categorization is complete.');
  } else if (band === 'green') {
    out.push('Keep the same monthly indicators review cadence to catch changes early.');
  }
  if (out.length < 2) {
    out.push('Use detailed reports in the system when you need to compare this month to prior months.');
  }
  return out.slice(0, 2);
}

/** Column header + data rows for invoice-period purchase categories (no numbered section title). */
function purchaseCategoryTable(
  extended: ExtendedReportingInsightsPayload,
  merged: CombinedInsightWarning[],
): { linesAr: string[]; linesEn: string[] } | null {
  const eps = INSIGHT_THRESHOLDS.salesEpsilon;
  const purchaseRows = extended.purchaseSupplierInsights.periodPurchaseCategoryBreakdown?.slice(0, 5);
  const purchaseTotalStr = extended.purchaseSupplierInsights.periodPurchaseCategoryTotal;
  const purchaseTotal = purchaseTotalStr != null ? parseInvoiceAmountStr(purchaseTotalStr) : 0;
  if (!purchaseRows?.length || purchaseTotal <= eps) return null;
  const linesAr = ['الفئة\tالمبلغ\tمن إجمالي المشتريات\tالحالة'];
  const linesEn = ['Category\tAmount\t% of purchases\tStatus'];
  for (const row of purchaseRows) {
    const amt = parseInvoiceAmountStr(row.amount);
    const share = amt / purchaseTotal;
    const pct = formatInsightPercentFraction(share);
    const stAr = purchaseRowStatusAr(row, merged);
    const stEn = purchaseRowStatusEn(row, merged);
    const label = row.nameAr?.trim() || row.nameEn || '—';
    const labelEn = row.nameEn?.trim() || row.nameAr || '—';
    linesAr.push(`${label}\t${row.amount}\t${pct}%\t${stAr}`);
    linesEn.push(`${labelEn}\t${row.amount}\t${pct}%\t${stEn}`);
  }
  return { linesAr, linesEn };
}

/** Column header + data rows for P&L expense categories for the month (no numbered section title). */
function expenseCategoryTable(
  extended: ExtendedReportingInsightsPayload,
  merged: CombinedInsightWarning[],
): { linesAr: string[]; linesEn: string[] } | null {
  const expenseRows = extended.expenseInsights.expenseCategoryBreakdown?.slice(0, 5);
  if (!expenseRows?.length) return null;
  const linesAr = ['الفئة\tالمبلغ\tمن إجمالي المصاريف\tالحالة'];
  const linesEn = ['Category\tAmount\t% of expenses\tStatus'];
  for (const row of expenseRows) {
    const share = row.shareOfGroupTotal;
    const pct = share != null && Number.isFinite(share) ? `${formatInsightPercentFraction(share)}%` : '—';
    linesAr.push(`${row.labelAr}\t${row.amountDisplay}\t${pct}\t${expenseRowStatusAr(row.key, merged)}`);
    linesEn.push(`${row.labelEn}\t${row.amountDisplay}\t${pct}\t${expenseRowStatusEn(row.key, merged)}`);
  }
  return { linesAr, linesEn };
}

function buildMoneyOverviewAnswer(
  extended: ExtendedReportingInsightsPayload,
  merged: CombinedInsightWarning[],
  year: number,
  selectedMonth: number,
): { answerAr: string; answerEn: string } {
  const payload = extended.dashboardInsights;
  const periodAr = formatInsightsPeriodLabelAr(year, selectedMonth);
  const periodEn = formatInsightsPeriodLabelEn(year, selectedMonth);
  const m = payload.metrics.accounting;
  const r = payload.ratios;

  const snapAr: string[] = [];
  const snapEn: string[] = [];
  if (accountingCellPresent(m.sales)) {
    snapAr.push(`المبيعات\t${String(m.sales).trim()}`);
    snapEn.push(`Sales\t${String(m.sales).trim()}`);
  }
  if (accountingCellPresent(m.purchases)) {
    snapAr.push(`المشتريات\t${String(m.purchases).trim()}`);
    snapEn.push(`Purchases\t${String(m.purchases).trim()}`);
  }
  if (accountingCellPresent(m.expenses)) {
    snapAr.push(`المصاريف\t${String(m.expenses).trim()}`);
    snapEn.push(`Expenses\t${String(m.expenses).trim()}`);
  }
  if (accountingCellPresent(m.netProfit)) {
    snapAr.push(`صافي الربح\t${String(m.netProfit).trim()}`);
    snapEn.push(`Net profit\t${String(m.netProfit).trim()}`);
  }
  if (r.purchaseToSales != null && Number.isFinite(r.purchaseToSales)) {
    snapAr.push(`مشتريات/مبيعات\t${formatInsightPercentFraction(r.purchaseToSales)}%`);
    snapEn.push(`Purchases / sales\t${formatInsightPercentFraction(r.purchaseToSales)}%`);
  }
  if (r.expenseToSales != null && Number.isFinite(r.expenseToSales)) {
    snapAr.push(`مصاريف/مبيعات\t${formatInsightPercentFraction(r.expenseToSales)}%`);
    snapEn.push(`Expenses / sales\t${formatInsightPercentFraction(r.expenseToSales)}%`);
  }
  if (r.netProfitMargin != null && Number.isFinite(r.netProfitMargin)) {
    snapAr.push(`هامش صافي الربح\t${formatInsightPercentFraction(r.netProfitMargin)}%`);
    snapEn.push(`Net margin\t${formatInsightPercentFraction(r.netProfitMargin)}%`);
  }

  const purchaseTable = purchaseCategoryTable(extended, merged);
  const expenseTable = expenseCategoryTable(extended, merged);

  const salesRows = payload.salesBreakdown?.slice(0, 5);
  const salesAr: string[] = [];
  const salesEn: string[] = [];
  if (salesRows?.length) {
    for (const row of salesRows) {
      const share = row.shareOfGroupTotal;
      const pct = share != null && Number.isFinite(share) ? `${formatInsightPercentFraction(share)}%` : '—';
      salesAr.push(`${row.labelAr}\t${row.amountDisplay}\t${pct}\t—`);
      salesEn.push(`${row.labelEn}\t${row.amountDisplay}\t${pct}\t—`);
    }
  }

  const warnPick = merged.slice(0, 3);
  const warnAr =
    warnPick.length > 0
      ? warnPick
          .map((w) => {
            const p = sourcePrefixAr(w);
            const d = w.detailAr?.trim();
            return d ? `• ${p}${w.titleAr}\n  ${d}` : `• ${p}${w.titleAr}`;
          })
          .join('\n')
      : MSG_NO_ALERT_AR;
  const warnEn =
    warnPick.length > 0
      ? warnPick
          .map((w) => {
            const p = sourcePrefixEn(w);
            const d = w.detailEn?.trim();
            return d ? `• ${p}${w.titleEn}\n  ${d}` : `• ${p}${w.titleEn}`;
          })
          .join('\n')
      : MSG_NO_ALERT_EN;

  const recoAr = overviewRecommendationsAr(payload.health.band)
    .map((line) => `• ${line}`)
    .join('\n');
  const recoEn = overviewRecommendationsEn(payload.health.band)
    .map((line) => `• ${line}`)
    .join('\n');

  const partsAr: string[] = ['تحليل الوضع المالي', '', periodAr, '', payload.health.summaryAr];
  const partsEn: string[] = ['Financial overview', '', periodEn, '', payload.health.summaryEn];

  if (snapAr.length > 0) {
    partsAr.push('', '١) لقطة مالية', 'النوع\tالمبلغ', ...snapAr);
    partsEn.push('', '1) Financial snapshot', 'Item\tAmount', ...snapEn);
  }
  if (purchaseTable) {
    partsAr.push('', '٢) مشتريات حسب الفئة (فترة الفواتير)', ...purchaseTable.linesAr);
    partsEn.push('', '2) Purchases by category (invoice period)', ...purchaseTable.linesEn);
  }
  if (expenseTable) {
    partsAr.push('', '٣) مصاريف حسب الفئة (دفتر الشهر)', ...expenseTable.linesAr);
    partsEn.push('', '3) Expenses by category (month ledger)', ...expenseTable.linesEn);
  }
  if (salesAr.length > 0) {
    partsAr.push('', '٤) المبيعات حسب المصدر (دفتر الشهر)', 'البند\tالمبلغ\tمن إجمالي المبيعات\tالحالة', ...salesAr);
    partsEn.push('', '4) Sales breakdown (month ledger)', 'Item\tAmount\t% of sales\tStatus', ...salesEn);
  }
  partsAr.push('', '٥) أبرز التنبيهات', warnAr);
  partsEn.push('', '5) Top alerts', warnEn);
  partsAr.push('', '٦) توصيات عملية', recoAr);
  partsEn.push('', '6) Practical recommendations', recoEn);

  return { answerAr: partsAr.join('\n'), answerEn: partsEn.join('\n') };
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
    return buildMoneyOverviewAnswer(extended, merged, year, selectedMonth);
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
export function buildInsightsExplanationPackage(
  payload: DashboardInsightsPayload,
  kind: DashboardInsightsQueryKind,
  year: number,
  selectedMonth: number,
): Record<string, unknown> {
  const warningsForPack =
    kind === 'general' ? payload.warnings.slice(0, 25) : filterWarnings(kind, payload.warnings);
  const mapItem = (w: InsightItem) => ({
    id: w.id,
    severity: w.severity,
    category: w.category,
    metricBasis: w.metricBasis,
    titleAr: w.titleAr,
    detailAr: w.detailAr,
    titleEn: w.titleEn,
    detailEn: w.detailEn,
    values: w.values,
  });
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
    warnings: warningsForPack.map(mapItem),
    insights: payload.insights.slice(0, 25).map(mapItem),
    ratios: payload.ratios,
    metrics: payload.metrics,
  };
}

function mapMergedForPack(w: CombinedInsightWarning) {
  return {
    id: w.id,
    severity: w.severity,
    category: w.category,
    metricBasis: w.metricBasis,
    titleAr: w.titleAr,
    detailAr: w.detailAr,
    titleEn: w.titleEn,
    detailEn: w.detailEn,
    values: w.values,
    source: w.source,
  };
}

/** حزمة موسّعة لـ LLM — رؤى مدمجة مع الحفاظ على حقول اللوحة الأساسية. */
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
  const c = countBySeverity(extended.warnings);
  return {
    ...base,
    warnings: mergedForPack.map(mapMergedForPack),
    mergedOverview: {
      total: extended.warnings.length,
      critical: c.critical,
      warning: c.warning,
      info: c.info,
      sourcesPresent: [...new Set(extended.warnings.map((w) => w.source))],
      focus,
    },
    purchaseSupplierWarningCount: extended.purchaseSupplierInsights.warnings.length,
    expenseWarningCount: extended.expenseInsights.warnings.length,
  };
}

export function queryLooksArabic(q: string): boolean {
  return /[\u0600-\u06FF]/.test(q);
}

/** أرقام مالية كبيرة في نص LLM يجب أن تظهر في JSON الحزمة — يقلل الادعاءات غير المدعومة */
function insightsLlmContainsUngroundedLargeNumber(text: string, packStr: string): boolean {
  const nums = text.match(/\b\d{4,}(?:[.,]\d+)?\b/g);
  if (!nums) return false;
  const flatPack = packStr.replace(/\s+/g, '');
  for (const num of nums) {
    const candidates = [num, num.replace(/,/g, ''), num.replace(/\./g, ',')];
    if (candidates.some((c) => flatPack.includes(c.replace(/\s+/g, '')))) continue;
    return true;
  }
  return false;
}

/** يُرجع true إذا كان نص LLM مقبولاً كبديل عن الرد الحتمي */
export function validateInsightsLlmAnswer(llm: { answerAr: string; answerEn: string }, packStr: string): boolean {
  const ar = String(llm.answerAr || '').trim();
  const en = String(llm.answerEn || '').trim();
  if (ar.length < 8 || en.length < 8) return false;
  const MAX = 1100;
  if (ar.length > MAX || en.length > MAX || ar.length + en.length > 2000) return false;
  if (/{/.test(ar) || /{/.test(en)) return false;
  if (insightsLlmContainsUngroundedLargeNumber(`${ar}\n${en}`, packStr)) return false;
  return true;
}

