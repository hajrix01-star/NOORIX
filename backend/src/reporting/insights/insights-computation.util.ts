import type { GeneralProfitLossModel } from '../../reports/reports-general-profit-loss-model.util';
import { INSIGHT_THRESHOLDS } from './insights.thresholds';
import type { InsightItem } from './insights.types';
import type { AccountingSnapshot } from './insights-accounting-snapshot.util';
import { formatInsightPercentFraction, parseAmount } from './insights-format.util';

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
    metricBasis: 'accounting_pl',
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
  return Array.isArray(months) && months.length > 0 ? (months as (string | number)[]) : null;
}

function priorMonthAmount(
  months: (string | number)[],
  mi: number,
): number | null {
  const idx = mi - 1;
  if (idx < 0) return null;
  const v = parseAmount(months[idx]);
  return v != null && Number.isFinite(v) ? v : null;
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

function extractGroupMonths(
  profitLoss: GeneralProfitLossModel | null | undefined,
  key: string,
): (string | number)[] | null {
  if (!profitLoss?.groups) return null;
  const group = profitLoss.groups.find((g) => (g as { key?: string }).key === key);
  const months = (group as { months?: unknown })?.months;
  return Array.isArray(months) ? (months as (string | number)[]) : null;
}

export type TrailingComparison = { trailingAvg: number | null; changeRatio: number | null };
export type TrailingComparisons = {
  purchases: TrailingComparison;
  expenses: TrailingComparison;
  grossProfit: TrailingComparison;
  netProfit: TrailingComparison;
};

/**
 * Compares each KPI metric to the **immediate prior month** only (not a multi-month average).
 * Returns nulls when selectedMonth is null (yearly view) or the prior month has no amount.
 */
export function computeTrailingComparisons(
  profitLoss: GeneralProfitLossModel | null | undefined,
  selectedMonth: number | null,
): TrailingComparisons {
  const empty: TrailingComparison = { trailingAvg: null, changeRatio: null };
  if (!profitLoss || selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) {
    return { purchases: empty, expenses: empty, grossProfit: empty, netProfit: empty };
  }
  const mi = selectedMonth - 1;
  const eps = INSIGHT_THRESHOLDS.salesEpsilon;

  function calc(months: (string | number)[] | null): TrailingComparison {
    if (!months) return empty;
    const priorMonth = priorMonthAmount(months, mi);
    if (priorMonth == null) return empty;
    const current = parseAmount(months[mi]);
    if (current == null || !Number.isFinite(current)) return empty;
    const rawRatio =
      Math.abs(priorMonth) <= eps ? null : (current - priorMonth) / Math.abs(priorMonth);
    return {
      trailingAvg: priorMonth,
      changeRatio: rawRatio != null && Number.isFinite(rawRatio) ? rawRatio : null,
    };
  }

  return {
    purchases: calc(extractGroupMonths(profitLoss, 'purchases')),
    expenses: calc(extractGroupMonths(profitLoss, 'expenses')),
    grossProfit: calc(extractSummaryRowMonths(profitLoss, 'grossProfit')),
    netProfit: calc(extractSummaryRowMonths(profitLoss, 'netProfit')),
  };
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
