import type { GeneralProfitLossModel } from '../../../reports/reports-general-profit-loss-model.util';
import { INSIGHT_THRESHOLDS } from '../insights.thresholds';
import { formatInsightPercentFraction, parseAmount } from '../insights.rules';
import type { InsightItem } from '../insights.types';
import { flattenPlGroupItems } from '../shared/pl-group-flatten.util';

const EPS = INSIGHT_THRESHOLDS.salesEpsilon;
const TH_TOP_CAT_WARN = 0.4;
const TH_TOP_CAT_CRIT = 0.55;
const TH_MISSING_CAT = 0.2;
const TH_SPIKE = INSIGHT_THRESHOLDS.unusuallyHighPurchases.increaseWarning;
const TH_FIXED_WARN = 0.25;
const TH_FIXED_CRIT = 0.35;

type PlRow = { key: string; labelAr: string; labelEn: string; months: string[] };

function expensesGroup(profitLoss: GeneralProfitLossModel | null | undefined) {
  return profitLoss?.groups?.find((g) => g.key === 'expenses');
}

function salesGroup(profitLoss: GeneralProfitLossModel | null | undefined) {
  return profitLoss?.groups?.find((g) => g.key === 'sales');
}

function expenseRows(profitLoss: GeneralProfitLossModel | null | undefined): PlRow[] {
  const g = expensesGroup(profitLoss);
  if (!g?.items) return [];
  return flattenPlGroupItems(g.items as Parameters<typeof flattenPlGroupItems>[0]) as PlRow[];
}

function monthAmount(row: PlRow | undefined, monthIndex0: number): number | null {
  if (!row?.months || monthIndex0 < 0 || monthIndex0 > 11) return null;
  return parseAmount(row.months[monthIndex0]);
}

/** Top `category:` share vs total expenses for the month (ignores kind/account buckets for the max). */
export function ruleTopExpenseCategoryShare(
  profitLoss: GeneralProfitLossModel | null | undefined,
  selectedMonth: number | null,
): InsightItem | null {
  if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return null;
  const mi = selectedMonth - 1;
  const expG = expensesGroup(profitLoss);
  const totalExpenses = parseAmount(expG?.months?.[mi]);
  if (totalExpenses == null || !Number.isFinite(totalExpenses) || totalExpenses <= EPS) return null;

  const rows = expenseRows(profitLoss).filter((r) => r.key.startsWith('category:'));
  if (rows.length === 0) return null;

  let top: PlRow | null = null;
  let topAmt = 0;
  for (const row of rows) {
    const a = monthAmount(row, mi) ?? 0;
    if (a > topAmt) {
      topAmt = a;
      top = row;
    }
  }
  if (!top || topAmt <= EPS) return null;

  const share = topAmt / totalExpenses;
  if (share < TH_TOP_CAT_WARN) return null;

  const severity = share >= TH_TOP_CAT_CRIT ? 'critical' : 'warning';
  const categoryId = top.key.replace(/^category:/, '');
  const sharePct = formatInsightPercentFraction(share);
  return {
    id: 'top_expense_category_share_warning',
    severity,
    category: 'expense',
    metricBasis: 'accounting_pl',
    titleAr: 'تركيز المصاريف على فئة واحدة',
    titleEn: 'Expenses concentrated in one category',
    detailAr: `أكبر فئة مصاريف تمثل ${sharePct}% من إجمالي مصاريف الشهر.`,
    detailEn: `The largest expense category represents ${sharePct}% of the month's total expenses.`,
    values: {
      categoryId,
      categoryNameAr: top.labelAr,
      categoryNameEn: top.labelEn,
      share,
      amount: topAmt,
      totalExpenses,
      thresholdWarning: TH_TOP_CAT_WARN,
      thresholdCritical: TH_TOP_CAT_CRIT,
    },
  };
}

/** Fallback `kind:` / `account:` expense amounts vs month total. */
export function ruleMissingExpenseCategory(
  profitLoss: GeneralProfitLossModel | null | undefined,
  selectedMonth: number | null,
): InsightItem | null {
  if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return null;
  const mi = selectedMonth - 1;
  const expG = expensesGroup(profitLoss);
  const totalExpenses = parseAmount(expG?.months?.[mi]);
  if (totalExpenses == null || !Number.isFinite(totalExpenses) || totalExpenses <= EPS) return null;

  let unc = 0;
  for (const row of expenseRows(profitLoss)) {
    if (row.key.startsWith('kind:') || row.key.startsWith('account:')) {
      unc += monthAmount(row, mi) ?? 0;
    }
  }
  const uncShare = unc / totalExpenses;
  if (uncShare < TH_MISSING_CAT) return null;

  const sharePct = formatInsightPercentFraction(uncShare);
  return {
    id: 'missing_expense_category_warning',
    severity: 'warning',
    category: 'expense',
    metricBasis: 'accounting_pl',
    titleAr: 'جزء كبير من المصاريف غير مرتبط بفئة واضحة',
    titleEn: 'Large share of expenses lacks a clear category',
    detailAr: `المصاريف المسجّلة كنوع/حساب عام تمثل ${sharePct}% من إجمالي مصاريف الشهر.`,
    detailEn: `Expenses recorded under generic kind/account buckets represent ${sharePct}% of the month's expenses.`,
    values: {
      uncategorizedShare: uncShare,
      uncategorizedAmount: unc,
      totalExpenses,
      thresholdWarning: TH_MISSING_CAT,
    },
  };
}

export function ruleUnusualExpenseSpike(
  profitLoss: GeneralProfitLossModel | null | undefined,
  selectedMonth: number | null,
): InsightItem | null {
  if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return null;
  const expG = expensesGroup(profitLoss);
  const months = expG?.months;
  if (!Array.isArray(months) || months.length < 12) return null;

  const mi = selectedMonth - 1;
  const priorVals: number[] = [];
  for (let offset = 1; offset <= 3; offset++) {
    const idx = mi - offset;
    if (idx < 0) break;
    const v = parseAmount(months[idx]);
    if (v != null && Number.isFinite(v)) priorVals.push(v);
  }
  if (priorVals.length < 2) return null;

  const trailingAverage = priorVals.reduce((s, n) => s + n, 0) / priorVals.length;
  if (!Number.isFinite(trailingAverage) || trailingAverage <= EPS) return null;

  const current = parseAmount(months[mi]);
  if (current == null || !Number.isFinite(current) || current <= trailingAverage) return null;

  const increaseRatio = (current - trailingAverage) / trailingAverage;
  if (!Number.isFinite(increaseRatio) || increaseRatio < TH_SPIKE) return null;

  const incPct = formatInsightPercentFraction(increaseRatio);
  return {
    id: 'unusual_expense_spike_warning',
    severity: 'warning',
    category: 'expense',
    metricBasis: 'accounting_pl',
    titleAr: 'ارتفاع ملحوظ في المصاريف',
    titleEn: 'Notable spike in expenses',
    detailAr: `مصاريف هذا الشهر أعلى من متوسط الأشهر السابقة بنسبة ${incPct}%.`,
    detailEn: `This month's expenses are ${incPct}% above the recent-month average.`,
    values: {
      currentExpenses: current,
      trailingAverage,
      increaseRatio,
      thresholdIncreaseWarning: TH_SPIKE,
      monthsUsed: priorVals.length,
    },
  };
}

export function ruleFixedExpensePressure(
  profitLoss: GeneralProfitLossModel | null | undefined,
  selectedMonth: number | null,
  recurringExpenseAmount?: number | null,
): InsightItem | null {
  if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return null;
  const mi = selectedMonth - 1;

  const fixedRow = expenseRows(profitLoss).find((r) => r.key === 'kind:fixed_expense');
  const fixedExpenses = recurringExpenseAmount ?? monthAmount(fixedRow, mi);
  if (fixedExpenses == null || !Number.isFinite(fixedExpenses) || fixedExpenses < 0) return null;

  const salesG = salesGroup(profitLoss);
  const sales = parseAmount(salesG?.months?.[mi]);
  if (sales == null || !Number.isFinite(sales) || sales <= EPS) return null;

  const fixedToSales = fixedExpenses / sales;
  if (fixedToSales < TH_FIXED_WARN) return null;

  const severity = fixedToSales >= TH_FIXED_CRIT ? 'critical' : 'warning';
  const ratioPct = formatInsightPercentFraction(fixedToSales);
  return {
    id: 'fixed_expense_pressure_warning',
    severity,
    category: 'expense',
    metricBasis: 'accounting_pl',
    titleAr: 'ضغط من المصاريف الدورية مقارنة بالمبيعات',
    titleEn: 'Recurring expense pressure vs sales',
    detailAr: `المصاريف الدورية تمثل ${ratioPct}% من مبيعات الشهر.`,
    detailEn: `Recurring expenses represent ${ratioPct}% of the month's sales.`,
    values: {
      fixedToSales,
      fixedExpenses,
      sales,
      thresholdWarning: TH_FIXED_WARN,
      thresholdCritical: TH_FIXED_CRIT,
    },
  };
}
