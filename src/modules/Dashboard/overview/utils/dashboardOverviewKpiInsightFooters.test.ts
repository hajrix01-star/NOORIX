import { describe, it, expect } from 'vitest';
import type { DashboardInsightsPayload } from '../../../../services/reportingInsightsApi';
import {
  buildKpiInsightFooterMap,
  formatInsightPercentDisplay,
  severityFooterValueClass,
} from './dashboardOverviewKpiInsightFooters';

/** Minimal `t` for predictable assertions */
function mockT(key: string, vars?: Record<string, string | number>): string {
  const v = vars ?? {};
  switch (key) {
    case 'dashboardKpiInsightPurchasesAboveWarn':
      return `${v.base}% — above limit ${v.limit}%`;
    case 'dashboardKpiInsightPurchasesAboveCrit':
      return `${v.base}% — critical: above limit ${v.limit}%`;
    case 'dashboardKpiInsightExpensesAboveWarn':
      return `${v.base}% — above limit ${v.limit}%`;
    case 'dashboardKpiInsightExpensesAboveCrit':
      return `${v.base}% — critical: above limit ${v.limit}%`;
    case 'dashboardKpiInsightNetMarginBelowWarn':
      return `${v.base}% — below limit ${v.limit}%`;
    case 'dashboardKpiInsightNetMarginBelowCrit':
      return `${v.base}% — critical: below limit ${v.limit}%`;
    case 'dashboardKpiInsightNetProfitNegative':
      return 'Negative net profit';
    case 'dashboardKpiInsightPurchasesUnusuallyHigh':
      return `Above normal (${v.avg} SR) by +${v.pct}%`;
    case 'dashboardKpiInsightExpensesUnusuallyHigh':
      return `Above normal (${v.avg} SR) by +${v.pct}%`;
    default:
      return key;
  }
}

describe('formatInsightPercentDisplay', () => {
  it('uses max one decimal and drops trailing .0', () => {
    expect(formatInsightPercentDisplay(35.5)).toBe('35.5');
    expect(formatInsightPercentDisplay(35)).toBe('35');
    expect(formatInsightPercentDisplay(41)).toBe('41');
  });
});

describe('severityFooterValueClass', () => {
  it('maps severities to design-system CSS vars', () => {
    expect(severityFooterValueClass('critical')).toContain('noorix-accent-red');
    expect(severityFooterValueClass('warning')).toContain('noorix-accent-amber');
    expect(severityFooterValueClass('info')).toContain('noorix-accent-blue');
  });
});

describe('buildKpiInsightFooterMap', () => {
  it('returns empty map when insights failed', () => {
    expect(buildKpiInsightFooterMap(undefined, true, mockT, false)).toEqual({});
  });

  it('purchases: warning ratio shows above limit with Latin digits', () => {
    const payload = {
      ratios: { purchaseToSales: 0.42, expenseToSales: 0.1 },
      warnings: [
        {
          id: 'purchase_ratio_to_sales',
          severity: 'warning',
          metricBasis: 'accounting_pl',
          values: { thresholdWarning: 0.35 },
        },
      ],
      insights: [],
    } as unknown as DashboardInsightsPayload;

    const m = buildKpiInsightFooterMap(payload, false, mockT, false);
    expect(m.purchases?.lines[0]?.text).toMatch(/42% — above limit 35%/);
    expect(m.purchases?.lines[0]?.severity).toBe('warning');
    expect(m.purchases?.lines[0]?.text).toMatch(/^\d/);
  });

  it('purchases: critical ratio shows critical copy', () => {
    const payload = {
      ratios: { purchaseToSales: 0.46, expenseToSales: 0.1 },
      warnings: [
        {
          id: 'purchase_ratio_to_sales',
          severity: 'critical',
          metricBasis: 'accounting_pl',
          values: { thresholdCritical: 0.45 },
        },
      ],
      insights: [],
    } as unknown as DashboardInsightsPayload;

    const m = buildKpiInsightFooterMap(payload, false, mockT, false);
    expect(m.purchases?.lines[0]?.text).toContain('critical: above limit 45%');
    expect(m.purchases?.lines[0]?.severity).toBe('critical');
  });

  it('purchases: normal ratio always shows (no insight needed)', () => {
    // No purchase_ratio_to_sales insight — ratio comes from payload.ratios
    const payload = {
      ratios: { purchaseToSales: 0.28, expenseToSales: 0.12 },
      warnings: [],
      insights: [],
    } as unknown as DashboardInsightsPayload;

    const m = buildKpiInsightFooterMap(payload, false, mockT, false);
    expect(m.purchases?.lines[0]?.text).toBe('28%');
    expect(m.purchases?.lines[0]?.severity).toBe('info');
    expect(m.purchases?.lines[0]?.compact).toBeUndefined();
  });

  it('purchases: unusually high shows ratio first then compact avg+pct', () => {
    const payload = {
      ratios: { purchaseToSales: 0.55, expenseToSales: 0.12 },
      warnings: [
        {
          id: 'unusually_high_purchases_warning',
          severity: 'warning',
          metricBasis: 'accounting_pl',
          values: { increaseRatio: 0.41, trailingAveragePurchases: 5000 },
        },
      ],
      insights: [],
    } as unknown as DashboardInsightsPayload;

    const m = buildKpiInsightFooterMap(payload, false, mockT, false);
    expect(m.purchases?.lines.length).toBe(2);
    // First line = ratio (not compact)
    expect(m.purchases?.lines[0]?.text).toBe('55%');
    expect(m.purchases?.lines[0]?.compact).toBeUndefined();
    // Second line = compact unusual warning with avg
    expect(m.purchases?.lines[1]?.compact).toBe(true);
    expect(m.purchases?.lines[1]?.text).toMatch(/Above normal/);
    expect(m.purchases?.lines[1]?.text).toMatch(/41%/);
    expect(m.purchases?.lines[1]?.text).toMatch(/SR/);
  });

  it('expenses: normal ratio always shows (no insight needed)', () => {
    // No expense_ratio_to_sales insight — ratio comes from payload.ratios
    const payload = {
      ratios: { purchaseToSales: 0.3, expenseToSales: 0.18 },
      warnings: [],
      insights: [],
    } as unknown as DashboardInsightsPayload;

    const m = buildKpiInsightFooterMap(payload, false, mockT, false);
    expect(m.expenses?.lines[0]?.text).toBe('18%');
    expect(m.expenses?.lines[0]?.compact).toBeUndefined();
  });

  it('expenses: unusually high shows ratio first then compact avg+pct', () => {
    const payload = {
      ratios: { purchaseToSales: 0.3, expenseToSales: 0.15 },
      warnings: [
        {
          id: 'unusual_expense_spike_warning',
          severity: 'warning',
          metricBasis: 'accounting_pl',
          values: { increaseRatio: 0.3, trailingAverage: 3000 },
        },
      ],
      insights: [],
    } as unknown as DashboardInsightsPayload;

    const m = buildKpiInsightFooterMap(payload, false, mockT, false);
    expect(m.expenses?.lines.length).toBe(2);
    expect(m.expenses?.lines[0]?.text).toBe('15%');
    expect(m.expenses?.lines[1]?.compact).toBe(true);
    expect(m.expenses?.lines[1]?.text).toMatch(/Above normal/);
    expect(m.expenses?.lines[1]?.text).toMatch(/30%/);
    expect(m.expenses?.lines[1]?.text).toMatch(/SR/);
  });

  it('expenses: warning footer text', () => {
    const payload = {
      ratios: { purchaseToSales: 0.3, expenseToSales: 0.42 },
      warnings: [
        {
          id: 'expense_ratio_to_sales',
          severity: 'warning',
          metricBasis: 'accounting_pl',
          values: { thresholdWarning: 0.4 },
        },
      ],
      insights: [],
    } as unknown as DashboardInsightsPayload;

    const m = buildKpiInsightFooterMap(payload, false, mockT, false);
    expect(m.expenses?.lines[0]?.text).toMatch(/42% — above limit 40%/);
  });

  it('net profit: margin below warning limit', () => {
    const payload = {
      warnings: [
        {
          id: 'net_profit_margin',
          severity: 'warning',
          metricBasis: 'accounting_pl',
          values: { netProfitMargin: 0.042, thresholdWarning: 0.1 },
        },
      ],
      insights: [],
    } as unknown as DashboardInsightsPayload;

    const m = buildKpiInsightFooterMap(payload, false, mockT, false);
    expect(m.netProfit?.footerLabelKey).toBe('dashboardKpiFooterNetProfitMarginLabel');
    expect(m.netProfit?.lines[0]?.text).toMatch(/4\.2% — below limit 10%/);
  });

  it('net profit: negative_profit_warning compact line', () => {
    const payload = {
      warnings: [
        {
          id: 'negative_profit_warning',
          severity: 'critical',
          metricBasis: 'accounting_pl',
          values: { netProfit: -100 },
        },
      ],
      insights: [],
    } as unknown as DashboardInsightsPayload;

    const m = buildKpiInsightFooterMap(payload, false, mockT, false);
    expect(m.netProfit?.lines[0]?.text).toBe('Negative net profit');
    expect(m.netProfit?.lines[0]?.compact).toBe(true);
  });

  it('caps purchase lines at 2', () => {
    const payload = {
      ratios: { purchaseToSales: 0.7, expenseToSales: 0.1 },
      warnings: [
        {
          id: 'purchase_ratio_to_sales',
          severity: 'warning',
          metricBasis: 'accounting_pl',
          values: { thresholdWarning: 0.65 },
        },
        {
          id: 'unusually_high_purchases_warning',
          severity: 'warning',
          metricBasis: 'accounting_pl',
          values: { increaseRatio: 0.5, trailingAveragePurchases: 8000 },
        },
      ],
      insights: [],
    } as unknown as DashboardInsightsPayload;

    const m = buildKpiInsightFooterMap(payload, false, mockT, false);
    expect(m.purchases?.lines.length).toBe(2);
  });
});
