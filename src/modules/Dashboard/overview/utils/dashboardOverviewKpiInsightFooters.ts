/**
 * Maps dashboard insights payload + P&L report to KPI footer table rows (display-only).
 * Each non-sales KPI card shows 3 rows in month view: ratio%, prior month, change vs prior month.
 */
import type { DashboardInsightsPayload } from '../../../../services/reportingInsightsApi';
import { fmt } from '../../../../utils/format';
import {
  getMonthlyData,
  getSectionPercentOfSales,
  type PlReportLike,
} from './dashboardOverviewCalculations';
import { formatSignedPercent } from '../../../../shared/reporting/plDisplaySelectors';

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

type KpiMetricKey = 'purchases' | 'expenses' | 'grossProfit' | 'netProfit';

/** Max 1 decimal, drop trailing .0 */
export function formatInsightPercentDisplay(n: number): string {
  const formatted = formatSignedPercent(n);
  return formatted === '—' ? '0' : formatted;
}

export function kpiFooterRowColorClass(color: KpiFooterRowColor | undefined): string {
  switch (color) {
    case 'positive': return 'text-noorix-green';
    case 'negative': return 'text-[color:var(--noorix-accent-red)]';
    case 'warning': return 'text-[color:var(--noorix-accent-amber)]';
    case 'critical': return 'text-[color:var(--noorix-accent-red)]';
    case 'muted': return 'text-noorix-muted';
    default: return 'text-[color:var(--noorix-accent-blue)]';
  }
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function parseAmount(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
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

function fmtChange(changeRatio: number): string {
  const pct = formatInsightPercentDisplay(Math.abs(changeRatio) * 100);
  return changeRatio >= 0 ? `+${pct}% ↑` : `-${pct}% ↓`;
}

function profitChangeColor(changeRatio: number): KpiFooterRowColor {
  return changeRatio >= 0 ? 'positive' : 'warning';
}

function costChangeColor(changeRatio: number): KpiFooterRowColor {
  return changeRatio > 0 ? 'warning' : 'positive';
}

function ratioColorFromThreshold(thresholdInsight: Record<string, unknown> | null): KpiFooterRowColor {
  if (!thresholdInsight) return 'info';
  const sev = readSeverity(thresholdInsight);
  if (sev === 'critical') return 'critical';
  if (sev === 'warning') return 'warning';
  return 'info';
}

function marginFractionFromReport(
  report: PlReportLike | null | undefined,
  key: KpiMetricKey,
  selectedMonth: number | null,
): number | null {
  const pct = getSectionPercentOfSales(report, key, selectedMonth);
  if (pct == null) return null;
  const n = parseFloat(pct);
  return Number.isFinite(n) ? n / 100 : null;
}

function priorMonthFromReport(
  report: PlReportLike | null | undefined,
  selectedMonth: number | null,
  key: KpiMetricKey,
): { trailingAvg: number | null; changeRatio: number | null } {
  const empty = { trailingAvg: null, changeRatio: null };
  if (!report || selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return empty;

  const months = getMonthlyData(report, key);
  if (!months.length) return empty;

  const mi = selectedMonth - 1;
  const priorMonth = parseAmount(months[mi - 1]);
  if (priorMonth == null || !Number.isFinite(priorMonth) || mi - 1 < 0) return empty;

  const current = parseAmount(months[mi]);
  if (current == null || !Number.isFinite(current)) return empty;

  const changeRatio =
    Math.abs(priorMonth) <= 0.000001 ? null : (current - priorMonth) / Math.abs(priorMonth);

  return {
    trailingAvg: priorMonth,
    changeRatio: changeRatio != null && Number.isFinite(changeRatio) ? changeRatio : null,
  };
}

function pickTrailing(
  apiAvg: number | null,
  apiChange: number | null,
  report: PlReportLike | null | undefined,
  selectedMonth: number | null,
  key: KpiMetricKey,
): { trailingAvg: number | null; changeRatio: number | null } {
  if (apiAvg != null || apiChange != null) {
    return { trailingAvg: apiAvg, changeRatio: apiChange };
  }
  return priorMonthFromReport(report, selectedMonth, key);
}

function pushTrailingRows(
  rows: KpiFooterRow[],
  t: TFn,
  trailingAvg: number | null,
  changeRatio: number | null,
  changeColorFn: (r: number) => KpiFooterRowColor,
  monthView: boolean,
): void {
  if (monthView) {
    rows.push({
      label: t('dashboardKpiFooterTrailingAvg'),
      value: trailingAvg != null ? `${fmt(trailingAvg)} SR` : '—',
      color: 'muted',
    });
    rows.push({
      label: t('dashboardKpiFooterChangeVsAvg'),
      value: changeRatio != null ? fmtChange(changeRatio) : '—',
      color: changeRatio != null ? changeColorFn(changeRatio) : 'muted',
    });
    return;
  }

  if (trailingAvg != null) {
    rows.push({
      label: t('dashboardKpiFooterTrailingAvg'),
      value: `${fmt(trailingAvg)} SR`,
      color: 'muted',
    });
  }
  if (changeRatio != null) {
    rows.push({
      label: t('dashboardKpiFooterChangeVsAvg'),
      value: fmtChange(changeRatio),
      color: changeColorFn(changeRatio),
    });
  }
}

/**
 * Builds footer row bundles for purchases, expenses, gross profit, net profit.
 * Uses API ratios when available; falls back to P&L report for margins and trailing stats.
 */
export function buildKpiInsightFooterMap(
  payload: DashboardInsightsPayload | undefined,
  insightsFailed: boolean,
  t: TFn,
  _isAr: boolean,
  report?: PlReportLike | null,
  selectedMonth?: number | null,
): KpiInsightFooterMap {
  if (insightsFailed && !report) return {};
  if (!payload && !report) return {};

  const monthView = selectedMonth != null && selectedMonth >= 1 && selectedMonth <= 12;
  const all = collectRawInsights(payload);
  const out: KpiInsightFooterMap = {};

  const ratios =
    payload?.ratios && typeof payload.ratios === 'object' && !Array.isArray(payload.ratios)
      ? (payload.ratios as Record<string, unknown>)
      : {};

  const rawPurchaseToSales =
    num(ratios.purchaseToSales) ?? marginFractionFromReport(report, 'purchases', selectedMonth ?? null);
  const rawExpenseToSales =
    num(ratios.expenseToSales) ?? marginFractionFromReport(report, 'expenses', selectedMonth ?? null);
  const rawGrossProfitMargin =
    num(ratios.grossProfitMargin) ?? marginFractionFromReport(report, 'grossProfit', selectedMonth ?? null);
  const rawNetProfitMargin =
    num(ratios.netProfitMargin) ?? marginFractionFromReport(report, 'netProfit', selectedMonth ?? null);

  const purchasesTrail = pickTrailing(
    num(ratios.trailingAvgPurchases),
    num(ratios.purchaseChangeRatio),
    report,
    selectedMonth ?? null,
    'purchases',
  );
  const expensesTrail = pickTrailing(
    num(ratios.trailingAvgExpenses),
    num(ratios.expenseChangeRatio),
    report,
    selectedMonth ?? null,
    'expenses',
  );
  const grossTrail = pickTrailing(
    num(ratios.trailingAvgGrossProfit),
    num(ratios.grossProfitChangeRatio),
    report,
    selectedMonth ?? null,
    'grossProfit',
  );
  const netTrail = pickTrailing(
    num(ratios.trailingAvgNetProfit),
    num(ratios.netProfitChangeRatio),
    report,
    selectedMonth ?? null,
    'netProfit',
  );

  /* ─── Purchases ─── */
  {
    const thresholdInsight = findRawById(all, 'purchase_ratio_to_sales');
    const rows: KpiFooterRow[] = [];

    if (rawPurchaseToSales != null) {
      const pct = formatInsightPercentDisplay(rawPurchaseToSales * 100);
      rows.push({
        label: t('dashboardKpiFooterRatioToSales'),
        value: `${pct}%`,
        color: ratioColorFromThreshold(thresholdInsight),
      });
    }

    pushTrailingRows(
      rows,
      t,
      purchasesTrail.trailingAvg,
      purchasesTrail.changeRatio,
      costChangeColor,
      monthView,
    );

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

    pushTrailingRows(
      rows,
      t,
      expensesTrail.trailingAvg,
      expensesTrail.changeRatio,
      costChangeColor,
      monthView,
    );

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

    pushTrailingRows(
      rows,
      t,
      grossTrail.trailingAvg,
      grossTrail.changeRatio,
      profitChangeColor,
      monthView,
    );

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
      else if (netMarginInsight) {
        color = readSeverity(netMarginInsight) === 'critical' ? 'critical' : 'warning';
      }
      rows.push({
        label: t('dashboardKpiFooterNetMargin'),
        value: `${pct}%`,
        color,
      });
    }

    pushTrailingRows(
      rows,
      t,
      netTrail.trailingAvg,
      negProfit ? null : netTrail.changeRatio,
      profitChangeColor,
      monthView,
    );

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
