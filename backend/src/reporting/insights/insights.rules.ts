import type { GeneralProfitLossModel } from '../../reports/reports-general-profit-loss-model.util';
import {
  mergeInsightThresholds,
  type CompanyInsightThresholdsPayload,
} from './company-insight-thresholds';
import { isCalendarMonthEntirelyInFuture } from './insights-accounting-snapshot.util';
import { formatInsightPercentFraction, parseAmount } from './insights-format.util';
import { INSIGHT_THRESHOLDS } from './insights.thresholds';
import type { InsightItem, InsightMetricBasis } from './insights.types';

export { formatInsightPercentFraction, parseAmount } from './insights-format.util';
export {
  extractAccountingSnapshot,
  isCalendarMonthEntirelyInFuture,
  rollupOperationalMonth,
  type AccountingSnapshot,
  type OperationalMonthRollup,
} from './insights-accounting-snapshot.util';
export {
  computeHealthBand,
  computeHealthScore,
  computeRatios,
  computeTrailingComparisons,
  ruleUnusualGrossProfitChange,
  ruleUnusualNetProfitChange,
  type TrailingComparison,
  type TrailingComparisons,
} from './insights-computation.util';

const BASIS_PL: InsightMetricBasis = 'accounting_pl';
const BASIS_OP: InsightMetricBasis = 'operational_sales';

export function rulePurchaseRatioToSales(
  purchaseToSales: number | null,
  thresholds: CompanyInsightThresholdsPayload = mergeInsightThresholds(undefined),
): InsightItem | null {
  if (purchaseToSales == null || !Number.isFinite(purchaseToSales)) return null;
  const { warning, critical } = thresholds.purchaseToSales;
  const actualPct = formatInsightPercentFraction(purchaseToSales);
  const warnPct = formatInsightPercentFraction(warning);
  const critPct = formatInsightPercentFraction(critical);
  if (purchaseToSales >= critical) {
    return {
      id: 'purchase_ratio_to_sales',
      severity: 'critical',
      category: 'ratio',
      metricBasis: BASIS_PL,
      titleAr: 'نسبة المشتريات إلى المبيعات مرتفعة جداً',
      titleEn: 'Very high purchase-to-sales ratio',
      detailAr: `المشتريات تمثل ${actualPct}% من المبيعات، وهي أعلى من حد الخطر المحدد ${critPct}%.`,
      detailEn: `Purchases represent ${actualPct}% of sales, above the configured critical threshold of ${critPct}%.`,
      values: { purchaseToSales, thresholdCritical: critical },
    };
  }
  if (purchaseToSales >= warning) {
    return {
      id: 'purchase_ratio_to_sales',
      severity: 'warning',
      category: 'ratio',
      metricBasis: BASIS_PL,
      titleAr: 'نسبة المشتريات إلى المبيعات مرتفعة',
      titleEn: 'High purchase-to-sales ratio',
      detailAr: `المشتريات تمثل ${actualPct}% من المبيعات، وهي أعلى من حد التحذير المحدد ${warnPct}%.`,
      detailEn: `Purchases represent ${actualPct}% of sales, above the configured warning threshold of ${warnPct}%.`,
      values: { purchaseToSales, thresholdWarning: warning },
    };
  }
  return null;
}

export function ruleExpenseRatioToSales(
  expenseToSales: number | null,
  thresholds: CompanyInsightThresholdsPayload = mergeInsightThresholds(undefined),
): InsightItem | null {
  if (expenseToSales == null || !Number.isFinite(expenseToSales)) return null;
  const { warning, critical } = thresholds.expenseToSales;
  const actualPct = formatInsightPercentFraction(expenseToSales);
  const warnPct = formatInsightPercentFraction(warning);
  const critPct = formatInsightPercentFraction(critical);
  if (expenseToSales >= critical) {
    return {
      id: 'expense_ratio_to_sales',
      severity: 'critical',
      category: 'ratio',
      metricBasis: BASIS_PL,
      titleAr: 'نسبة المصاريف إلى المبيعات مرتفعة جداً',
      titleEn: 'Very high expense-to-sales ratio',
      detailAr: `المصاريف تمثل ${actualPct}% من المبيعات، وهي أعلى من حد الخطر المحدد ${critPct}%.`,
      detailEn: `Expenses represent ${actualPct}% of sales, above the configured critical threshold of ${critPct}%.`,
      values: { expenseToSales, thresholdCritical: critical },
    };
  }
  if (expenseToSales >= warning) {
    return {
      id: 'expense_ratio_to_sales',
      severity: 'warning',
      category: 'ratio',
      metricBasis: BASIS_PL,
      titleAr: 'نسبة المصاريف إلى المبيعات مرتفعة',
      titleEn: 'High expense-to-sales ratio',
      detailAr: `المصاريف تمثل ${actualPct}% من المبيعات، وهي أعلى من حد التحذير المحدد ${warnPct}%.`,
      detailEn: `Expenses represent ${actualPct}% of sales, above the configured warning threshold of ${warnPct}%.`,
      values: { expenseToSales, thresholdWarning: warning },
    };
  }
  return null;
}

export function ruleNetProfitMargin(
  netProfitMargin: number | null,
  sales: number | null,
  thresholds: CompanyInsightThresholdsPayload = mergeInsightThresholds(undefined),
): InsightItem | null {
  if (netProfitMargin == null || !Number.isFinite(netProfitMargin)) return null;
  const eps = INSIGHT_THRESHOLDS.salesEpsilon;
  const warnBelow = thresholds.netProfitMargin.warningBelow;
  const critBelow = thresholds.netProfitMargin.criticalBelow;
  if (sales != null && Math.abs(sales) <= eps) return null;

  if (netProfitMargin < 0) {
    const mPct = formatInsightPercentFraction(netProfitMargin);
    return {
      id: 'net_profit_margin',
      severity: 'critical',
      category: 'margin',
      metricBasis: BASIS_PL,
      titleAr: 'هامش صافي الربح سالب',
      titleEn: 'Negative net profit margin',
      detailAr: `هامش صافي الربح ${mPct}%.`,
      detailEn: `Net profit margin is ${mPct}%.`,
      values: { netProfitMargin, sales },
    };
  }
  if (
    sales != null &&
    Math.abs(sales) > eps &&
    critBelow > 0 &&
    netProfitMargin >= 0 &&
    netProfitMargin < critBelow
  ) {
    const mPct = formatInsightPercentFraction(netProfitMargin);
    const cPct = formatInsightPercentFraction(critBelow);
    return {
      id: 'net_profit_margin',
      severity: 'critical',
      category: 'margin',
      metricBasis: BASIS_PL,
      titleAr: 'هامش صافي الربح منخفض جداً',
      titleEn: 'Very low net profit margin',
      detailAr: `هامش صافي الربح ${mPct}%، وهو أقل من حد الخطر المحدد ${cPct}%.`,
      detailEn: `Net profit margin is ${mPct}%, below the configured critical threshold of ${cPct}%.`,
      values: { netProfitMargin, thresholdCritical: critBelow },
    };
  }
  if (sales != null && Math.abs(sales) > eps && netProfitMargin >= 0 && netProfitMargin < warnBelow) {
    const mPct = formatInsightPercentFraction(netProfitMargin);
    const wPct = formatInsightPercentFraction(warnBelow);
    return {
      id: 'net_profit_margin',
      severity: 'warning',
      category: 'margin',
      metricBasis: BASIS_PL,
      titleAr: 'هامش صافي الربح منخفض',
      titleEn: 'Low net profit margin',
      detailAr: `هامش صافي الربح ${mPct}%، وهو أقل من الحد الصحي المحدد ${wPct}%.`,
      detailEn: `Net profit margin is ${mPct}%, below the configured healthy threshold of ${wPct}%.`,
      values: { netProfitMargin, thresholdWarning: warnBelow },
    };
  }
  return null;
}

export function ruleNegativeProfit(netProfit: number | null): InsightItem | null {
  if (netProfit == null || !Number.isFinite(netProfit)) return null;
  if (netProfit < 0) {
    return {
      id: 'negative_profit_warning',
      severity: 'critical',
      category: 'profit',
      metricBasis: BASIS_PL,
      titleAr: 'صافي الربح سالب',
      titleEn: 'Negative net profit',
      detailAr:
        'صافي الربح للفترة المحددة سلبي. راجع المشتريات والمصاريف المؤثرة على النتيجة.',
      detailEn:
        'Net profit is negative for the selected period. Review purchases and expenses affecting the result.',
      values: { netProfit },
    };
  }
  return null;
}

/**
 * Flags when accounting purchases for the selected month exceed the average of prior months
 * in the same P&L year by at least {@link INSIGHT_THRESHOLDS.unusuallyHighPurchases.increaseWarning}.
 * Uses up to three immediate prior months; requires at least two valid prior purchase amounts.
 */
export function ruleUnusuallyHighPurchases(
  profitLoss: GeneralProfitLossModel | null | undefined,
  selectedMonth: number | null,
): InsightItem | null {
  if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return null;
  if (!profitLoss || typeof profitLoss !== 'object') return null;

  const increaseWarning = INSIGHT_THRESHOLDS.unusuallyHighPurchases.increaseWarning;
  const eps = INSIGHT_THRESHOLDS.salesEpsilon;

  const purG = profitLoss.groups?.find((g) => g.key === 'purchases');
  const months = purG?.months;
  if (!Array.isArray(months)) return null;

  const mi = selectedMonth - 1;
  const priorVals: number[] = [];
  for (let offset = 1; offset <= 3; offset++) {
    const idx = mi - offset;
    if (idx < 0) break;
    const raw = months[idx];
    const v = parseAmount(raw);
    if (v != null && Number.isFinite(v)) {
      priorVals.push(v);
    }
  }

  if (priorVals.length < 2) return null;

  const trailingAveragePurchases = priorVals.reduce((sum, n) => sum + n, 0) / priorVals.length;
  if (!Number.isFinite(trailingAveragePurchases) || trailingAveragePurchases <= eps) return null;

  const rawCurrent = months[mi];
  const currentPurchases = parseAmount(rawCurrent);
  if (currentPurchases == null || !Number.isFinite(currentPurchases)) return null;

  if (currentPurchases <= trailingAveragePurchases) return null;

  const increaseRatio = (currentPurchases - trailingAveragePurchases) / trailingAveragePurchases;
  if (!Number.isFinite(increaseRatio) || increaseRatio < increaseWarning) return null;

  const increasePct = formatInsightPercentFraction(increaseRatio);

  return {
    id: 'unusually_high_purchases_warning',
    severity: 'warning',
    category: 'cost_control',
    metricBasis: BASIS_PL,
    titleAr: 'ارتفاع غير معتاد في المشتريات',
    titleEn: 'Unusually high purchases',
    detailAr: `مشتريات هذا الشهر أعلى من متوسط آخر أشهر بنسبة ${increasePct}%. راجع أسباب الزيادة قبل اعتمادها كسلوك طبيعي.`,
    detailEn: `Purchases this month are ${increasePct}% above the recent-month average. Review the increase before treating it as normal.`,
    values: {
      currentPurchases,
      trailingAveragePurchases,
      increaseRatio,
      thresholdIncreaseWarning: increaseWarning,
      monthsUsed: priorVals.length,
    },
  };
}

/**
 * Operational daily-sales coverage — **not emitted in dashboard insights v1** (`DashboardInsightsService` omits this rule).
 * Kept for a possible future mode where daily operational summaries are mandatory; current usage relies on accounting P&L revenue.
 */
export function ruleMissingSalesData(
  activeSalesDaysInMonth: number | null,
  selectedMonth: number | null,
  year: number,
  ref: Date,
): InsightItem | null {
  if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return null;
  if (activeSalesDaysInMonth == null) return null;
  if (activeSalesDaysInMonth > 0) return null;
  if (isCalendarMonthEntirelyInFuture(year, selectedMonth, ref)) return null;
  return {
    id: 'missing_sales_data_warning',
    severity: 'warning',
    category: 'data_quality',
    metricBasis: BASIS_OP,
    titleAr: 'لا توجد مبيعات تشغيلية مسجّلة',
    titleEn: 'No operational sales recorded',
    detailAr:
      'لا توجد أيام بمبيعات تشغيلية (>٠) في الملخصات اليومية لهذا الشهر، والشهر ليس بالكامل في المستقبل. تحقق من الإدخال.',
    detailEn:
      'No operational sales days with amount > 0 in daily summaries for this month, and the month is not entirely in the future. Check data entry.',
    values: { activeSalesDaysInMonth, year, selectedMonth },
  };
}
