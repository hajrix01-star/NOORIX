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
export function purchaseCategoryTable(
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
export function expenseCategoryTable(
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

export function buildMoneyOverviewAnswer(
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
      : noAlertMessages.noAlertAr;
  const warnEn =
    warnPick.length > 0
      ? warnPick
          .map((w) => {
            const p = sourcePrefixEn(w);
            const d = w.detailEn?.trim();
            return d ? `• ${p}${w.titleEn}\n  ${d}` : `• ${p}${w.titleEn}`;
          })
          .join('\n')
      : noAlertMessages.noAlertEn;

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
