/**
 * Maps dashboard insights payload to KPI footer table rows (display-only).
 * Each non-sales KPI card shows up to 3 rows: ratio%, trailing avg, change vs avg.
 */
import type { DashboardInsightsPayload } from '../../../../services/reportingInsightsApi';
import { fmt } from '../../../../utils/format';

export type KpiInsightSeverity = 'info' | 'warning' | 'critical';

/** Color token for a footer row value */
export type KpiFooterRowColor = 'positive' | 'negative' | 'warning' | 'critical' | 'muted' | 'info';

export type KpiFooterRow = {
  label: string;
  value: string;
  color?: KpiFooterRowColor;
  tooltip?: string;
};

export type KpiInsightFooterBundle = {
  rows: KpiFooterRow[];
};

export type KpiInsightFooterMap = Partial<
  Record<'purchases' | 'expenses' | 'grossProfit' | 'netProfit', KpiInsightFooterBundle | null>
>;

type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** Max 1 decimal, drop trailing .0 */
export function formatInsightPercentDisplay(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 10) / 10;
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

export function kpiFooterRowColorClass(color: KpiFooterRowColor | undefined): string {
  switch (color) {
    case 'positive':  return 'text-noorix-green';
    case 'negative':  return 'text-[color:var(--noorix-accent-red)]';
    case 'warning':   return 'text-[color:var(--noorix-accent-amber)]';
    case 'critical':  return 'text-[color:var(--noorix-accent-red)]';
    case 'muted':     return 'text-noorix-muted';
    default:          return 'text-[color:var(--noorix-accent-blue)]';
  }
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function collectRawInsights(payload: DashboardInsightsPayload | undefined): unknown[] {
  if (!payload) return [];
  const w = Array.isArray(payload.warnings) ? payload.warnings : [];
  const i = Array.isArray(payload.insights) ? payload.insights : [];
  return [...w, ...i];
}

function findRawById(items: unknown[], id: string): Record<string, unknown> | null {
  for (const x of items) {
    if (x && typeof x === 'object' && String((x as Record<string, unknown>).id) === id) {
      return x as Record<string, unknown>;
    }
  }
  return null;
}

function readValues(raw: Record<string, unknown>): Record<string, unknown> {
  const v = raw.values;
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function readSeverity(raw: Record<string, unknown>): KpiInsightSeverity {
  const s = raw.severity;
  if (s === 'critical') return 'critical';
  if (s === 'warning') return 'warning';
  return 'info';
}

/** Format change ratio (+/-X.X% with arrow) */
function fmtChange(changeRatio: number): string {
  const pct = formatInsightPercentDisplay(Math.abs(changeRatio) * 100);
  return changeRatio >= 0 ? `+${pct}% ↑` : `-${pct}% ↓`;
}

/** Change color: positive = good, negative = bad (for profit cards) */
function profitChangeColor(changeRatio: number): KpiFooterRowColor {
  return changeRatio >= 0 ? 'positive' : 'warning';
}

/** Change color: positive = bad, negative = good (for cost cards) */
function costChangeColor(changeRatio: number): KpiFooterRowColor {
  return changeRatio > 0 ? 'warning' : 'positive';
}

/**
 * Builds the ratio row color for purchases/expenses based on threshold insight severity.
 * Falls back to 'info' when no threshold is crossed.
 */
function ratioColorFromThreshold(
  thresholdInsight: Record<string, unknown> | null,
): KpiFooterRowColor {
  if (!thresholdInsight) return 'info';
  const sev = readSeverity(thresholdInsight);
  if (sev === 'critical') return 'critical';
  if (sev === 'warning') return 'warning';
  return 'info';
}

/**
 * Builds footer row bundles for all 4 KPI cards: purchases, expenses, gross profit, net profit.
 * Returns {} when insightsFailed or payload is missing.
 */
export function buildKpiInsightFooterMap(
  payload: DashboardInsightsPayload | undefined,
  insightsFailed: boolean,
  t: TFn,
  _isAr: boolean,
): KpiInsightFooterMap {
  if (insightsFailed || !payload) return {};

  const all = collectRawInsights(payload);
  const out: KpiInsightFooterMap = {};

  const ratios =
    payload.ratios && typeof payload.ratios === 'object' && !Array.isArray(payload.ratios)
      ? (payload.ratios as Record<string, unknown>)
      : {};

  /* ─── helpers ─── */
  const rawPurchaseToSales      = num(ratios.purchaseToSales);
  const rawExpenseToSales       = num(ratios.expenseToSales);
  const rawGrossProfitMargin    = num(ratios.grossProfitMargin);
  const rawNetProfitMargin      = num(ratios.netProfitMargin);

  const trailingAvgPurchases    = num(ratios.trailingAvgPurchases);
  const purchaseChangeRatio     = num(ratios.purchaseChangeRatio);
  const trailingAvgExpenses     = num(ratios.trailingAvgExpenses);
  const expenseChangeRatio      = num(ratios.expenseChangeRatio);
  const trailingAvgGrossProfit  = num(ratios.trailingAvgGrossProfit);
  const grossProfitChangeRatio  = num(ratios.grossProfitChangeRatio);
  const trailingAvgNetProfit    = num(ratios.trailingAvgNetProfit);
  const netProfitChangeRatio    = num(ratios.netProfitChangeRatio);

  /* ─── Purchases ─── */
  {
    const thresholdInsight = findRawById(all, 'purchase_ratio_to_sales');
    const rows: KpiFooterRow[] = [];

    if (rawPurchaseToSales != null) {
      const pct = formatInsightPercentDisplay(rawPurchaseToSales * 100);
      let tooltip: string | undefined;
      if (thresholdInsight) {
        const vals = readValues(thresholdInsight);
        const tw = num(vals.thresholdWarning);
        const tc = num(vals.thresholdCritical);
        const limit = tc != null && readSeverity(thresholdInsight) === 'critical' ? tc : tw;
        if (limit != null) {
          const limitPct = formatInsightPercentDisplay(limit * 100);
          tooltip = `${t('dashboardKpiFooterRatioToSales')}: ${pct}% (${t('dashboardKpiInsightPurchasesAboveWarn', { base: pct, limit: limitPct })})`;
        }
      }
      rows.push({
        label: t('dashboardKpiFooterRatioToSales'),
        value: `${pct}%`,
        color: ratioColorFromThreshold(thresholdInsight),
        tooltip,
      });
    }

    if (trailingAvgPurchases != null) {
      rows.push({
        label: t('dashboardKpiFooterTrailingAvg'),
        value: `${fmt(trailingAvgPurchases)} SR`,
        color: 'muted',
      });
    }

    if (purchaseChangeRatio != null) {
      rows.push({
        label: t('dashboardKpiFooterChangeVsAvg'),
        value: fmtChange(purchaseChangeRatio),
        color: costChangeColor(purchaseChangeRatio),
      });
    }

    if (rows.length > 0) out.purchases = { rows };
  }

  /* ─── Expenses ─── */
  {
    const thresholdInsight = findRawById(all, 'expense_ratio_to_sales');
    const rows: KpiFooterRow[] = [];

    if (rawExpenseToSales != null) {
      const pct = formatInsightPercentDisplay(rawExpenseToSales * 100);
      rows.push({
        label: t('dashboardKpiFooterRatioToSales'),
        value: `${pct}%`,
        color: ratioColorFromThreshold(thresholdInsight),
      });
    }

    if (trailingAvgExpenses != null) {
      rows.push({
        label: t('dashboardKpiFooterTrailingAvg'),
        value: `${fmt(trailingAvgExpenses)} SR`,
        color: 'muted',
      });
    }

    if (expenseChangeRatio != null) {
      rows.push({
        label: t('dashboardKpiFooterChangeVsAvg'),
        value: fmtChange(expenseChangeRatio),
        color: costChangeColor(expenseChangeRatio),
      });
    }

    if (rows.length > 0) out.expenses = { rows };
  }

  /* ─── Gross Profit ─── */
  {
    const rows: KpiFooterRow[] = [];

    if (rawGrossProfitMargin != null) {
      const pct = formatInsightPercentDisplay(rawGrossProfitMargin * 100);
      rows.push({
        label: t('dashboardKpiFooterGrossMargin'),
        value: `${pct}%`,
        color: 'info',
      });
    }

    if (trailingAvgGrossProfit != null) {
      rows.push({
        label: t('dashboardKpiFooterTrailingAvg'),
        value: `${fmt(trailingAvgGrossProfit)} SR`,
        color: 'muted',
      });
    }

    if (grossProfitChangeRatio != null) {
      rows.push({
        label: t('dashboardKpiFooterChangeVsAvg'),
        value: fmtChange(grossProfitChangeRatio),
        color: profitChangeColor(grossProfitChangeRatio),
      });
    }

    if (rows.length > 0) out.grossProfit = { rows };
  }

  /* ─── Net Profit ─── */
  {
    const negProfit = findRawById(all, 'negative_profit_warning');
    const netMarginInsight = findRawById(all, 'net_profit_margin');
    const rows: KpiFooterRow[] = [];

    if (rawNetProfitMargin != null) {
      const pct = formatInsightPercentDisplay(rawNetProfitMargin * 100);
      let color: KpiFooterRowColor = 'info';
      if (negProfit || rawNetProfitMargin < 0) color = 'critical';
      else if (netMarginInsight) color = readSeverity(netMarginInsight) === 'critical' ? 'critical' : 'warning';
      rows.push({
        label: t('dashboardKpiFooterNetMargin'),
        value: `${pct}%`,
        color,
      });
    }

    if (trailingAvgNetProfit != null) {
      rows.push({
        label: t('dashboardKpiFooterTrailingAvg'),
        value: `${fmt(trailingAvgNetProfit)} SR`,
        color: 'muted',
      });
    }

    if (netProfitChangeRatio != null && !negProfit) {
      rows.push({
        label: t('dashboardKpiFooterChangeVsAvg'),
        value: fmtChange(netProfitChangeRatio),
        color: profitChangeColor(netProfitChangeRatio),
      });
    }

    if (rows.length > 0) out.netProfit = { rows };
  }

  return out;
}

/** @deprecated Use kpiFooterRowColorClass instead */
export function severityFooterValueClass(severity: KpiInsightSeverity): string {
  if (severity === 'critical') return 'text-[color:var(--noorix-accent-red)]';
  if (severity === 'warning') return 'text-[color:var(--noorix-accent-amber)]';
  return 'text-[color:var(--noorix-accent-blue)]';
}
