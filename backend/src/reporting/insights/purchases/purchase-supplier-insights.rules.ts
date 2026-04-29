import type { GeneralProfitLossModel } from '../../../reports/reports-general-profit-loss-model.util';
import { INSIGHT_THRESHOLDS } from '../insights.thresholds';
import { formatInsightPercentFraction, parseAmount } from '../insights.rules';
import type { InsightItem } from '../insights.types';
import { flattenPlGroupItems } from '../shared/pl-group-flatten.util';

const EPS = INSIGHT_THRESHOLDS.salesEpsilon;
const TH_CONC_WARN = 0.5;
const TH_CONC_CRIT = 0.65;
const TH_UNCAT_PURCH_WARN = 0.15;
const TH_UNCAT_PURCH_CRIT = 0.3;
const TH_SUPPLIER_MISS = 0.25;
const TH_SPIKE = INSIGHT_THRESHOLDS.unusuallyHighPurchases.increaseWarning;

export type PurchaseCategoryBreakdownRow = {
  categoryId: string | null;
  nameAr: string;
  nameEn: string | null;
  amount: string;
};

export type SupplierCategoryBreakdownRow = {
  categoryId: string | null;
  nameAr: string;
  nameEn: string | null;
  count: number;
};

function parseDecimalString(s: unknown): number {
  const n = parseFloat(String(s ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

/** Top **categorized** purchase category concentration (excludes categoryId === null from winning). */
export function rulePurchaseCategoryConcentration(
  breakdown: PurchaseCategoryBreakdownRow[] | undefined,
  purchaseCategoryTotal: string | undefined,
): InsightItem | null {
  if (!breakdown?.length) return null;
  const periodTotal = parseDecimalString(purchaseCategoryTotal);
  if (periodTotal <= EPS) return null;

  const categorized = breakdown.filter((r) => r.categoryId != null);
  if (categorized.length === 0) return null;

  let top: PurchaseCategoryBreakdownRow | null = null;
  let topAmt = 0;
  for (const row of categorized) {
    const a = parseDecimalString(row.amount);
    if (a > topAmt) {
      topAmt = a;
      top = row;
    }
  }
  if (!top || topAmt <= EPS) return null;

  const topShare = topAmt / periodTotal;
  if (topShare < TH_CONC_WARN) return null;

  const severity = topShare >= TH_CONC_CRIT ? 'critical' : 'warning';
  const sharePct = formatInsightPercentFraction(topShare);
  return {
    id: 'purchase_category_concentration_warning',
    severity,
    category: 'purchase_supplier',
    metricBasis: 'invoice_period',
    titleAr: 'تركيز مرتفع على فئة مشتريات واحدة',
    titleEn: 'High concentration in one purchase category',
    detailAr: `أكبر فئة مشتريات (غير «غير مصنّف») تمثل ${sharePct}% من إجمالي مشتريات الفترة.`,
    detailEn: `The largest categorized purchase category represents ${sharePct}% of period purchase total.`,
    values: {
      topCategoryId: top.categoryId,
      topCategoryNameAr: top.nameAr,
      topCategoryNameEn: top.nameEn,
      topShare,
      topAmount: topAmt,
      periodTotal,
      thresholdWarning: TH_CONC_WARN,
      thresholdCritical: TH_CONC_CRIT,
    },
  };
}

export function rulePurchaseUncategorizedShare(
  breakdown: PurchaseCategoryBreakdownRow[] | undefined,
  purchaseCategoryTotal: string | undefined,
): InsightItem | null {
  if (!breakdown?.length) return null;
  const periodTotal = parseDecimalString(purchaseCategoryTotal);
  if (periodTotal <= EPS) return null;

  const uncRow = breakdown.find((r) => r.categoryId === null);
  const uncAmt = uncRow ? parseDecimalString(uncRow.amount) : 0;
  const uncShare = uncAmt / periodTotal;
  if (uncShare < TH_UNCAT_PURCH_WARN) return null;

  const severity = uncShare >= TH_UNCAT_PURCH_CRIT ? 'critical' : 'warning';
  const sharePct = formatInsightPercentFraction(uncShare);
  return {
    id: 'purchase_uncategorized_share_warning',
    severity,
    category: 'purchase_supplier',
    metricBasis: 'invoice_period',
    titleAr: 'جزء كبير من المشتريات غير مصنف',
    titleEn: 'Large share of purchases is uncategorized',
    detailAr: `المشتريات غير المصنّفة تمثل ${sharePct}% من إجمالي مشتريات الفترة.`,
    detailEn: `Uncategorized purchases represent ${sharePct}% of period purchase total.`,
    values: {
      uncategorizedShare: uncShare,
      uncategorizedAmount: uncAmt,
      periodTotal,
      thresholdWarning: TH_UNCAT_PURCH_WARN,
      thresholdCritical: TH_UNCAT_PURCH_CRIT,
    },
  };
}

export function ruleMissingSupplierBreakdown(
  supplierCategoryBreakdown: SupplierCategoryBreakdownRow[] | undefined,
  suppliersInPeriodCount: number | undefined,
): InsightItem | null {
  const total = suppliersInPeriodCount ?? 0;
  if (total < 3) return null;
  if (!supplierCategoryBreakdown?.length) return null;

  const uncRow = supplierCategoryBreakdown.find((r) => r.categoryId === null);
  const uncategorizedCount = uncRow?.count ?? 0;
  const uncShare = uncategorizedCount / total;
  if (uncShare < TH_SUPPLIER_MISS) return null;

  const sharePct = formatInsightPercentFraction(uncShare);
  return {
    id: 'missing_supplier_breakdown_warning',
    severity: 'warning',
    category: 'purchase_supplier',
    metricBasis: 'invoice_period',
    titleAr: 'عدد ملحوظ من الموردين دون فئة',
    titleEn: 'Many active suppliers lack a category',
    detailAr: `${uncategorizedCount} من أصل ${total} موردًا نشطًا دون فئة مورد (${sharePct}%).`,
    detailEn: `${uncategorizedCount} of ${total} active suppliers lack a supplier category (${sharePct}%).`,
    values: {
      uncategorizedCount,
      totalSuppliers: total,
      uncategorizedShare: uncShare,
      thresholdWarning: TH_SUPPLIER_MISS,
    },
  };
}

type PlLikeRow = { key: string; labelAr: string; labelEn: string; months: string[] };

function purchasesCategoryRows(profitLoss: GeneralProfitLossModel | null | undefined): PlLikeRow[] {
  if (!profitLoss?.groups) return [];
  const pur = profitLoss.groups.find((g) => g.key === 'purchases');
  if (!pur?.items) return [];
  return flattenPlGroupItems(pur.items as Parameters<typeof flattenPlGroupItems>[0]).filter((row) =>
    row.key.startsWith('category:'),
  ) as PlLikeRow[];
}

/** Strongest single category spike vs trailing 2–3 prior months (accounting P&L). */
export function rulePurchaseCategorySpike(
  profitLoss: GeneralProfitLossModel | null | undefined,
  selectedMonth: number | null,
): InsightItem | null {
  if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return null;
  const rows = purchasesCategoryRows(profitLoss);
  if (rows.length === 0) return null;

  const mi = selectedMonth - 1;
  let best: InsightItem | null = null;
  let bestRatio = 0;

  for (const row of rows) {
    const months = row.months;
    if (!Array.isArray(months) || months.length < 12) continue;

    const priorVals: number[] = [];
    for (let offset = 1; offset <= 3; offset++) {
      const idx = mi - offset;
      if (idx < 0) break;
      const v = parseAmount(months[idx]);
      if (v != null && Number.isFinite(v)) priorVals.push(v);
    }
    if (priorVals.length < 2) continue;

    const trailingAverage = priorVals.reduce((s, n) => s + n, 0) / priorVals.length;
    if (!Number.isFinite(trailingAverage) || trailingAverage <= EPS) continue;

    const current = parseAmount(months[mi]);
    if (current == null || !Number.isFinite(current) || current <= trailingAverage) continue;

    const increaseRatio = (current - trailingAverage) / trailingAverage;
    if (!Number.isFinite(increaseRatio) || increaseRatio < TH_SPIKE) continue;

    if (increaseRatio <= bestRatio) continue;
    bestRatio = increaseRatio;

    const categoryId = row.key.replace(/^category:/, '');
    const incPct = formatInsightPercentFraction(increaseRatio);
    best = {
      id: 'purchase_category_spike_warning',
      severity: 'warning',
      category: 'purchase_supplier',
      metricBasis: 'accounting_pl',
      titleAr: 'ارتفاع ملحوظ في مشتريات فئة معينة',
      titleEn: 'Notable spike in a purchase category',
      detailAr: `مشتريات الفئة «${row.labelAr}» لهذا الشهر أعلى من متوسط الأشهر السابقة بنسبة ${incPct}%.`,
      detailEn: `Purchases for category "${row.labelEn || row.labelAr}" are ${incPct}% above the recent-month average.`,
      values: {
        categoryId,
        categoryNameAr: row.labelAr,
        categoryNameEn: row.labelEn,
        currentAmount: current,
        trailingAverage,
        increaseRatio,
        thresholdIncreaseWarning: TH_SPIKE,
        monthsUsed: priorVals.length,
      },
    };
  }

  return best;
}
