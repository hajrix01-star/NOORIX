import type { GeneralProfitLossModel } from '../../reports/reports-general-profit-loss-model.util';
import { INSIGHT_THRESHOLDS } from './insights.thresholds';
import type { InsightItem, InsightMetricBasis } from './insights.types';

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

export function rulePurchaseRatioToSales(purchaseToSales: number | null): InsightItem | null {
  if (purchaseToSales == null || !Number.isFinite(purchaseToSales)) return null;
  const { warning, critical } = INSIGHT_THRESHOLDS.purchaseToSales;
  if (purchaseToSales >= critical) {
    return {
      id: 'purchase_ratio_to_sales',
      severity: 'critical',
      category: 'ratio',
      metricBasis: BASIS_PL,
      titleAr: 'نسبة المشتريات إلى المبيعات مرتفعة جداً',
      titleEn: 'Very high purchase-to-sales ratio',
      detailAr: `نسبة المشتريات إلى المبيعات (محاسبية) تبلغ ${(purchaseToSales * 100).toFixed(1)}% وتصل أو تتجاوز الحد الحرج.`,
      detailEn: `Accounting purchase-to-sales ratio is ${(purchaseToSales * 100).toFixed(1)}%, at or above the critical threshold.`,
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
      detailAr: `نسبة المشتريات إلى المبيعات (محاسبية) تبلغ ${(purchaseToSales * 100).toFixed(1)}% وتصل أو تتجاوز حد التحذير.`,
      detailEn: `Accounting purchase-to-sales ratio is ${(purchaseToSales * 100).toFixed(1)}%, at or above the warning threshold.`,
      values: { purchaseToSales, thresholdWarning: warning },
    };
  }
  return null;
}

export function ruleExpenseRatioToSales(expenseToSales: number | null): InsightItem | null {
  if (expenseToSales == null || !Number.isFinite(expenseToSales)) return null;
  const { warning, critical } = INSIGHT_THRESHOLDS.expenseToSales;
  if (expenseToSales >= critical) {
    return {
      id: 'expense_ratio_to_sales',
      severity: 'critical',
      category: 'ratio',
      metricBasis: BASIS_PL,
      titleAr: 'نسبة المصاريف إلى المبيعات مرتفعة جداً',
      titleEn: 'Very high expense-to-sales ratio',
      detailAr: `نسبة المصاريف إلى المبيعات (محاسبية) تبلغ ${(expenseToSales * 100).toFixed(1)}% وتصل أو تتجاوز الحد الحرج.`,
      detailEn: `Accounting expense-to-sales ratio is ${(expenseToSales * 100).toFixed(1)}%, at or above the critical threshold.`,
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
      detailAr: `نسبة المصاريف إلى المبيعات (محاسبية) تبلغ ${(expenseToSales * 100).toFixed(1)}% وتصل أو تتجاوز حد التحذير.`,
      detailEn: `Accounting expense-to-sales ratio is ${(expenseToSales * 100).toFixed(1)}%, at or above the warning threshold.`,
      values: { expenseToSales, thresholdWarning: warning },
    };
  }
  return null;
}

export function ruleNetProfitMargin(netProfitMargin: number | null, sales: number | null): InsightItem | null {
  if (netProfitMargin == null || !Number.isFinite(netProfitMargin)) return null;
  const thr = INSIGHT_THRESHOLDS.netProfitMargin.warningHigh;
  const eps = INSIGHT_THRESHOLDS.salesEpsilon;
  if (sales != null && Math.abs(sales) <= eps) return null;

  if (netProfitMargin < 0) {
    return {
      id: 'net_profit_margin',
      severity: 'critical',
      category: 'margin',
      metricBasis: BASIS_PL,
      titleAr: 'هامش صافي الربح سالب',
      titleEn: 'Negative net profit margin',
      detailAr: `هامش صافي الربح (محاسبي) سالب بنسبة ${(netProfitMargin * 100).toFixed(1)}% من المبيعات.`,
      detailEn: `Accounting net profit margin is negative: ${(netProfitMargin * 100).toFixed(1)}% of sales.`,
      values: { netProfitMargin, sales },
    };
  }
  if (sales != null && Math.abs(sales) > eps && netProfitMargin >= 0 && netProfitMargin < thr) {
    return {
      id: 'net_profit_margin',
      severity: 'warning',
      category: 'margin',
      metricBasis: BASIS_PL,
      titleAr: 'هامش صافي الربح منخفض',
      titleEn: 'Low net profit margin',
      detailAr: `هامش صافي الربح (محاسبي) ${(netProfitMargin * 100).toFixed(1)}% دون حد التحذير (${(thr * 100).toFixed(0)}%).`,
      detailEn: `Accounting net profit margin is ${(netProfitMargin * 100).toFixed(1)}%, below the ${(thr * 100).toFixed(0)}% warning guide.`,
      values: { netProfitMargin, thresholdWarning: thr },
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
      detailAr: `صافي الربح (محاسبي) للفترة سالب: ${netProfit.toFixed(2)}.`,
      detailEn: `Accounting net profit for the period is negative: ${netProfit.toFixed(2)}.`,
      values: { netProfit },
    };
  }
  return null;
}

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
): { purchaseToSales: number | null; expenseToSales: number | null; netProfitMargin: number | null } {
  const eps = INSIGHT_THRESHOLDS.salesEpsilon;
  if (!snap) {
    notes.push('Accounting snapshot unavailable.');
    return { purchaseToSales: null, expenseToSales: null, netProfitMargin: null };
  }
  const { sales, purchases, expenses, netProfit } = snap.numeric;
  if (sales == null || purchases == null || expenses == null) {
    notes.push('Missing accounting components for ratio.');
    return { purchaseToSales: null, expenseToSales: null, netProfitMargin: null };
  }
  if (Math.abs(sales) <= eps) {
    notes.push('Sales near zero — ratios omitted.');
    return {
      purchaseToSales: null,
      expenseToSales: null,
      netProfitMargin: null,
    };
  }
  const purchaseToSales = purchases / sales;
  const expenseToSales = expenses / sales;
  const netProfitMargin = netProfit != null ? netProfit / sales : null;
  return { purchaseToSales, expenseToSales, netProfitMargin };
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
