import type { GeneralProfitLossModel } from '../../reports/reports-general-profit-loss-model.util';
import {
  mergeInsightThresholds,
  type CompanyInsightThresholdsPayload,
} from './company-insight-thresholds';
import { INSIGHT_THRESHOLDS } from './insights.thresholds';
import type { InsightItem, InsightMetricBasis } from './insights.types';

/**
 * Formats a fractional ratio (e.g. 0.355) for insight copy: percentage with max one decimal,
 * no trailing ".0" for whole numbers. Display-only; does not alter underlying numeric inputs.
 */
export function formatInsightPercentFraction(fraction: number): string {
  const pct = fraction * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (!Number.isFinite(rounded)) return '0';
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

export type AccountingSnapshot = {
  raw: {
    sales: string | number | null;
    purchases: string | number | null;
    expenses: string | number | null;
    grossProfit: string | number | null;
    netProfit: string | number | null;
  };
  numeric: {
    sales: number | null;
    purchases: number | null;
    expenses: number | null;
    grossProfit: number | null;
    netProfit: number | null;
  };
};

export function parseAmount(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

/** Defensive extraction — missing fields yield nulls without throwing. */
export function extractAccountingSnapshot(
  profitLoss: GeneralProfitLossModel | null | undefined,
  selectedMonth: number | null,
): AccountingSnapshot | null {
  if (!profitLoss || typeof profitLoss !== 'object') {
    return null;
  }
  const cards = profitLoss.cards;
  const groups = profitLoss.groups;
  const summaryRows = profitLoss.summaryRows;

  if (selectedMonth != null && selectedMonth >= 1 && selectedMonth <= 12) {
    const mi = selectedMonth - 1;
    const salesG = groups?.find((g) => g.key === 'sales');
    const purG = groups?.find((g) => g.key === 'purchases');
    const expG = groups?.find((g) => g.key === 'expenses');
    const grossR = summaryRows?.find((r) => r.key === 'grossProfit');
    const netR = summaryRows?.find((r) => r.key === 'netProfit');

    const raw = {
      sales: salesG?.months?.[mi] ?? null,
      purchases: purG?.months?.[mi] ?? null,
      expenses: expG?.months?.[mi] ?? null,
      grossProfit: grossR?.months?.[mi] ?? null,
      netProfit: netR?.months?.[mi] ?? null,
    };
    return {
      raw,
      numeric: {
        sales: parseAmount(raw.sales),
        purchases: parseAmount(raw.purchases),
        expenses: parseAmount(raw.expenses),
        grossProfit: parseAmount(raw.grossProfit),
        netProfit: parseAmount(raw.netProfit),
      },
    };
  }

  const raw = {
    sales: cards?.sales ?? null,
    purchases: cards?.purchases ?? null,
    expenses: cards?.expenses ?? null,
    grossProfit: cards?.grossProfit ?? null,
    netProfit: cards?.netProfit ?? null,
  };
  return {
    raw,
    numeric: {
      sales: parseAmount(raw.sales),
      purchases: parseAmount(raw.purchases),
      expenses: parseAmount(raw.expenses),
      grossProfit: parseAmount(raw.grossProfit),
      netProfit: parseAmount(raw.netProfit),
    },
  };
}

export type OperationalMonthRollup = {
  periodSalesFromSummaries: number | null;
  activeSalesDaysInMonth: number | null;
};

function parseYmd(dateStr: unknown): { y: number; month: number; day: number } | null {
  if (dateStr == null) return null;
  const s = String(dateStr).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** Sum totals and active days from dashboard sales pack for a calendar month (operational). */
export function rollupOperationalMonth(
  salesPack: unknown,
  year: number,
  selectedMonth: number | null,
): OperationalMonthRollup {
  if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) {
    return { periodSalesFromSummaries: null, activeSalesDaysInMonth: null };
  }
  const pack = salesPack as {
    dailySummaries?: Array<{ transactionDate?: unknown; totalAmount?: unknown }>;
    monthSummaries?: Array<{ transactionDate?: unknown; totalAmount?: unknown }>;
  } | null;

  const byDay = new Map<string, number>();

  const addRow = (transactionDate: unknown, totalAmount: unknown) => {
    const p = parseYmd(transactionDate);
    if (!p || p.y !== year || p.month !== selectedMonth) return;
    const key = `${p.y}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    const amt = parseAmount(totalAmount) ?? 0;
    byDay.set(key, (byDay.get(key) ?? 0) + amt);
  };

  const ds = pack?.dailySummaries;
  if (Array.isArray(ds)) {
    for (const row of ds) {
      addRow(row?.transactionDate, row?.totalAmount);
    }
  }

  if (byDay.size === 0 && Array.isArray(pack?.monthSummaries)) {
    for (const row of pack.monthSummaries) {
      addRow(row?.transactionDate, row?.totalAmount);
    }
  }

  let periodSales = 0;
  let activeDays = 0;
  for (const v of byDay.values()) {
    periodSales += v;
    if (v > 0) activeDays += 1;
  }

  if (byDay.size === 0) {
    return {
      periodSalesFromSummaries: 0,
      activeSalesDaysInMonth: 0,
    };
  }

  return {
    periodSalesFromSummaries: periodSales,
    activeSalesDaysInMonth: activeDays,
  };
}

export function isCalendarMonthEntirelyInFuture(year: number, month: number, ref: Date): boolean {
  const start = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  const refDay = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), 0, 0, 0, 0);
  return start > refDay;
}

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

export function computeRatios(
  snap: AccountingSnapshot | null,
  notes: string[],
): {
  purchaseToSales: number | null;
  expenseToSales: number | null;
  grossProfitMargin: number | null;
  netProfitMargin: number | null;
} {
  const eps = INSIGHT_THRESHOLDS.salesEpsilon;
  const nullAll = { purchaseToSales: null, expenseToSales: null, grossProfitMargin: null, netProfitMargin: null };
  if (!snap) {
    notes.push('Accounting snapshot unavailable.');
    return nullAll;
  }
  const { sales, purchases, expenses, grossProfit, netProfit } = snap.numeric;
  if (sales == null || purchases == null || expenses == null) {
    notes.push('Missing accounting components for ratio.');
    return nullAll;
  }
  if (Math.abs(sales) <= eps) {
    notes.push('Sales near zero — ratios omitted.');
    return nullAll;
  }
  const purchaseToSales = purchases / sales;
  const expenseToSales = expenses / sales;
  const grossProfitMargin = grossProfit != null ? grossProfit / sales : null;
  const netProfitMargin = netProfit != null ? netProfit / sales : null;
  return { purchaseToSales, expenseToSales, grossProfitMargin, netProfitMargin };
}

const TH_PROFIT_CHANGE = INSIGHT_THRESHOLDS.unusualProfitChange.changeWarning;

function buildUnusualProfitChangeItem(
  id: string,
  current: number,
  trailingAverage: number,
  priorValsLength: number,
  titleArUp: string,
  titleArDown: string,
  titleEnUp: string,
  titleEnDown: string,
  detailArUp: (pct: string) => string,
  detailArDown: (pct: string) => string,
  detailEnUp: (pct: string) => string,
  detailEnDown: (pct: string) => string,
): InsightItem | null {
  const changeRatio = (current - trailingAverage) / Math.abs(trailingAverage);
  if (!Number.isFinite(changeRatio) || Math.abs(changeRatio) < TH_PROFIT_CHANGE) return null;
  const isUp = changeRatio > 0;
  const pct = formatInsightPercentFraction(Math.abs(changeRatio));
  return {
    id,
    severity: isUp ? 'info' : 'warning',
    category: 'profitability',
    metricBasis: 'accounting_pl' as InsightMetricBasis,
    titleAr: isUp ? titleArUp : titleArDown,
    titleEn: isUp ? titleEnUp : titleEnDown,
    detailAr: isUp ? detailArUp(pct) : detailArDown(pct),
    detailEn: isUp ? detailEnUp(pct) : detailEnDown(pct),
    values: { current, trailingAverage, changeRatio, thresholdChangeWarning: TH_PROFIT_CHANGE, monthsUsed: priorValsLength },
  };
}

function extractSummaryRowMonths(
  profitLoss: GeneralProfitLossModel | null | undefined,
  key: string,
): (string | number)[] | null {
  if (!profitLoss?.summaryRows) return null;
  const row = profitLoss.summaryRows.find((r) => (r as { key?: string }).key === key);
  const months = (row as { months?: unknown })?.months;
  return Array.isArray(months) && months.length >= 12 ? (months as (string | number)[]) : null;
}

function trailingAvgForMonth(
  months: (string | number)[],
  mi: number,
  lookback: number = 3,
): { average: number; count: number } | null {
  const vals: number[] = [];
  for (let offset = 1; offset <= lookback; offset++) {
    const idx = mi - offset;
    if (idx < 0) break;
    const v = parseAmount(months[idx]);
    if (v != null && Number.isFinite(v)) vals.push(v);
  }
  if (vals.length < 2) return null;
  return { average: vals.reduce((s, n) => s + n, 0) / vals.length, count: vals.length };
}

export function ruleUnusualGrossProfitChange(
  profitLoss: GeneralProfitLossModel | null | undefined,
  selectedMonth: number | null,
): InsightItem | null {
  if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return null;
  const months = extractSummaryRowMonths(profitLoss, 'grossProfit');
  if (!months) return null;
  const mi = selectedMonth - 1;
  const trail = trailingAvgForMonth(months, mi);
  if (!trail || Math.abs(trail.average) <= INSIGHT_THRESHOLDS.salesEpsilon) return null;
  const current = parseAmount(months[mi]);
  if (current == null || !Number.isFinite(current)) return null;
  return buildUnusualProfitChangeItem(
    'unusual_gross_profit_change',
    current, trail.average, trail.count,
    'ارتفاع غير معتاد في الربح الإجمالي', 'انخفاض غير معتاد في الربح الإجمالي',
    'Unusually high gross profit', 'Unusually low gross profit',
    (p) => `الربح الإجمالي هذا الشهر أعلى من متوسط الأشهر السابقة بنسبة ${p}%.`,
    (p) => `الربح الإجمالي هذا الشهر أقل من متوسط الأشهر السابقة بنسبة ${p}%.`,
    (p) => `Gross profit this month is ${p}% above the recent-month average.`,
    (p) => `Gross profit this month is ${p}% below the recent-month average.`,
  );
}

export function ruleUnusualNetProfitChange(
  profitLoss: GeneralProfitLossModel | null | undefined,
  selectedMonth: number | null,
): InsightItem | null {
  if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return null;
  const months = extractSummaryRowMonths(profitLoss, 'netProfit');
  if (!months) return null;
  const mi = selectedMonth - 1;
  const trail = trailingAvgForMonth(months, mi);
  if (!trail || Math.abs(trail.average) <= INSIGHT_THRESHOLDS.salesEpsilon) return null;
  const current = parseAmount(months[mi]);
  if (current == null || !Number.isFinite(current)) return null;
  return buildUnusualProfitChangeItem(
    'unusual_net_profit_change',
    current, trail.average, trail.count,
    'ارتفاع غير معتاد في صافي الربح', 'انخفاض غير معتاد في صافي الربح',
    'Unusually high net profit', 'Unusually low net profit',
    (p) => `صافي الربح هذا الشهر أعلى من متوسط الأشهر السابقة بنسبة ${p}%.`,
    (p) => `صافي الربح هذا الشهر أقل من متوسط الأشهر السابقة بنسبة ${p}%.`,
    (p) => `Net profit this month is ${p}% above the recent-month average.`,
    (p) => `Net profit this month is ${p}% below the recent-month average.`,
  );
}

export function computeHealthBand(warnings: InsightItem[]): 'green' | 'amber' | 'red' | 'unknown' {
  if (warnings.length === 0) return 'green';
  if (warnings.some((w) => w.severity === 'critical')) return 'red';
  if (warnings.some((w) => w.severity === 'warning' || w.severity === 'info')) return 'amber';
  return 'unknown';
}

export function computeHealthScore(warnings: InsightItem[]): number | null {
  if (warnings.length === 0) return 85;
  const crit = warnings.filter((w) => w.severity === 'critical').length;
  const warn = warnings.filter((w) => w.severity === 'warning').length;
  if (crit > 0) return Math.max(0, 40 - crit * 15);
  if (warn > 0) return Math.max(45, 70 - warn * 10);
  return 75;
}
