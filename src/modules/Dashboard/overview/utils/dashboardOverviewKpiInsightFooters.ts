/**
 * Maps dashboard insights payload to KPI footer lines (display-only).
 * Arabic/English copy via `t()`; English digits in numeric segments only.
 */
import type { DashboardInsightsPayload } from '../../../../services/reportingInsightsApi';
import { fmt } from '../../../../utils/format';

export type KpiInsightSeverity = 'info' | 'warning' | 'critical';

export type KpiInsightFooterLine = {
  text: string;
  severity: KpiInsightSeverity;
  /** Native tooltip (full insight detail) */
  title?: string;
  /** Smaller secondary line */
  compact?: boolean;
};

export type KpiInsightFooterBundle = {
  /** Optional i18n key to replace footer ratio label (e.g. net profit margin) */
  footerLabelKey?: string;
  lines: KpiInsightFooterLine[];
};

export type KpiInsightFooterMap = Partial<
  Record<'purchases' | 'expenses' | 'netProfit', KpiInsightFooterBundle | null>
>;

type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** Max 1 decimal, drop trailing .0 — matches backend insight display helper. */
export function formatInsightPercentDisplay(pctOrFractionTimes100: number): string {
  const n = pctOrFractionTimes100;
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 10) / 10;
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

/** `values.threshold*` are decimals (e.g. 0.35 → 35%). */
export function formatThresholdPercentFromFraction(fraction: number | null | undefined): string {
  if (fraction == null || !Number.isFinite(fraction)) return '';
  return formatInsightPercentDisplay(fraction * 100);
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

function readSeverity(raw: Record<string, unknown>): KpiInsightSeverity {
  const s = raw.severity;
  if (s === 'critical') return 'critical';
  if (s === 'warning') return 'warning';
  return 'info';
}

function readValues(raw: Record<string, unknown>): Record<string, unknown> {
  const v = raw.values;
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function detailTitle(raw: Record<string, unknown>, isAr: boolean): string | undefined {
  const ar = typeof raw.detailAr === 'string' ? raw.detailAr : '';
  const en = typeof raw.detailEn === 'string' ? raw.detailEn : '';
  const s = isAr ? ar : en;
  return s.trim() || undefined;
}

/**
 * Builds footer bundles for Purchases / Expenses / Net Profit KPI cards.
 * When `insightsFailed`, returns {} so existing KPI footers stay unchanged.
 */
export function buildKpiInsightFooterMap(
  payload: DashboardInsightsPayload | undefined,
  insightsFailed: boolean,
  t: TFn,
  isAr: boolean,
): KpiInsightFooterMap {
  if (insightsFailed || !payload) return {};

  const all = collectRawInsights(payload);
  const out: KpiInsightFooterMap = {};

  /* ─── Purchases ─── */
  const purchaseRatio = findRawById(all, 'purchase_ratio_to_sales');
  const unusualPurchases = findRawById(all, 'unusually_high_purchases_warning');
  const purchaseLines: KpiInsightFooterLine[] = [];

  if (purchaseRatio) {
    const sev = readSeverity(purchaseRatio);
    const vals = readValues(purchaseRatio);
    const ratio = num(vals.purchaseToSales);
    const tw = num(vals.thresholdWarning);
    const tc = num(vals.thresholdCritical);
    const base =
      ratio != null ? formatInsightPercentDisplay(ratio * 100) : '';
    let text = '';
    if (sev === 'critical' && tc != null) {
      const limit = formatThresholdPercentFromFraction(tc);
      text = t('dashboardKpiInsightPurchasesAboveCrit', { base, limit });
    } else if (tw != null) {
      const limit = formatThresholdPercentFromFraction(tw);
      text = t('dashboardKpiInsightPurchasesAboveWarn', { base, limit });
    } else if (ratio != null) {
      // Normal range — still show ratio so unusually_high line doesn't hide the default badge
      text = `${base}%`;
    }
    if (text) {
      purchaseLines.push({
        text,
        severity: sev,
        title: detailTitle(purchaseRatio, isAr),
      });
    }
  }

  if (unusualPurchases) {
    const sev = readSeverity(unusualPurchases);
    const vals = readValues(unusualPurchases);
    const inc = num(vals.increaseRatio);
    if (inc != null) {
      const pct = formatInsightPercentDisplay(inc * 100);
      const trailAvg = num(vals.trailingAveragePurchases);
      const avg = trailAvg != null ? fmt(trailAvg) : '—';
      purchaseLines.push({
        text: t('dashboardKpiInsightPurchasesUnusuallyHigh', { pct, avg }),
        severity: sev,
        title: detailTitle(unusualPurchases, isAr),
        compact: true,
      });
    }
  }

  if (purchaseLines.length > 2) purchaseLines.length = 2;
  if (purchaseLines.length > 0) {
    out.purchases = { lines: purchaseLines };
  }

  /* ─── Expenses ─── */
  const expenseRatio = findRawById(all, 'expense_ratio_to_sales');
  const unusualExpenses = findRawById(all, 'unusual_expense_spike_warning');
  const expenseLines: KpiInsightFooterLine[] = [];

  if (expenseRatio) {
    const sev = readSeverity(expenseRatio);
    const vals = readValues(expenseRatio);
    const ratio = num(vals.expenseToSales);
    const tw = num(vals.thresholdWarning);
    const tc = num(vals.thresholdCritical);
    const base = ratio != null ? formatInsightPercentDisplay(ratio * 100) : '';
    let text = '';
    if (sev === 'critical' && tc != null) {
      const limit = formatThresholdPercentFromFraction(tc);
      text = t('dashboardKpiInsightExpensesAboveCrit', { base, limit });
    } else if (tw != null) {
      const limit = formatThresholdPercentFromFraction(tw);
      text = t('dashboardKpiInsightExpensesAboveWarn', { base, limit });
    } else if (ratio != null) {
      // Normal range — still show ratio so unusually_high line doesn't hide the default badge
      text = `${base}%`;
    }
    if (text) {
      expenseLines.push({ text, severity: sev, title: detailTitle(expenseRatio, isAr) });
    }
  }

  if (unusualExpenses) {
    const sev = readSeverity(unusualExpenses);
    const vals = readValues(unusualExpenses);
    const inc = num(vals.increaseRatio);
    if (inc != null) {
      const pct = formatInsightPercentDisplay(inc * 100);
      const trailAvg = num(vals.trailingAverage);
      const avg = trailAvg != null ? fmt(trailAvg) : '—';
      expenseLines.push({
        text: t('dashboardKpiInsightExpensesUnusuallyHigh', { pct, avg }),
        severity: sev,
        title: detailTitle(unusualExpenses, isAr),
        compact: true,
      });
    }
  }

  if (expenseLines.length > 2) expenseLines.length = 2;
  if (expenseLines.length > 0) {
    out.expenses = { lines: expenseLines };
  }

  /* ─── Net profit ─── */
  const netMargin = findRawById(all, 'net_profit_margin');
  const negProfit = findRawById(all, 'negative_profit_warning');
  const netLines: KpiInsightFooterLine[] = [];
  let footerLabelKey: string | undefined;

  if (netMargin) {
    const sev = readSeverity(netMargin);
    const vals = readValues(netMargin);
    const margin = num(vals.netProfitMargin);
    const tw = num(vals.thresholdWarning);
    const tc = num(vals.thresholdCritical);
    const base = margin != null ? formatInsightPercentDisplay(margin * 100) : '';
    let text = '';
    if (sev === 'critical' && tc != null && tc > 0) {
      const limit = formatThresholdPercentFromFraction(tc);
      text = t('dashboardKpiInsightNetMarginBelowCrit', { base, limit });
    } else if (tw != null) {
      const limit = formatThresholdPercentFromFraction(tw);
      text = t('dashboardKpiInsightNetMarginBelowWarn', { base, limit });
    }
    if (text) {
      footerLabelKey = 'dashboardKpiFooterNetProfitMarginLabel';
      netLines.push({
        text,
        severity: sev,
        title: detailTitle(netMargin, isAr),
      });
    } else if (margin != null) {
      footerLabelKey = 'dashboardKpiFooterNetProfitMarginLabel';
      netLines.push({
        text: `${formatInsightPercentDisplay(margin * 100)}%`,
        severity: sev,
        title: detailTitle(netMargin, isAr),
      });
    }
  }

  if (negProfit) {
    const sev = readSeverity(negProfit);
    netLines.push({
      text: t('dashboardKpiInsightNetProfitNegative'),
      severity: sev,
      title: detailTitle(negProfit, isAr),
      compact: true,
    });
  }

  if (netLines.length > 2) netLines.length = 2;
  if (netLines.length > 0) {
    out.netProfit = { lines: netLines, footerLabelKey };
  }

  return out;
}

export function severityFooterValueClass(severity: KpiInsightSeverity): string {
  if (severity === 'critical') return 'text-[color:var(--noorix-accent-red)]';
  if (severity === 'warning') return 'text-[color:var(--noorix-accent-amber)]';
  return 'text-[color:var(--noorix-accent-blue)]';
}
