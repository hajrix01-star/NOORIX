import { describe, it, expect } from 'vitest';
import type { DashboardInsightsPayload } from '../../../../services/reportingInsightsApi';
import {
  buildKpiInsightFooterMap,
  formatInsightPercentDisplay,
  kpiFooterRowColorClass,
  severityFooterValueClass,
} from './dashboardOverviewKpiInsightFooters';

function mockT(key: string, vars?: Record<string, string | number>): string {
  const v = vars ?? {};
  switch (key) {
    case 'dashboardKpiFooterRatioToSales':
      return '% of Sales';
    case 'dashboardKpiFooterGrossMargin':
      return 'Gross Margin';
    case 'dashboardKpiFooterNetMargin':
      return 'Net Margin';
    case 'dashboardKpiFooterTrailingAvg':
      return 'Previous month';
    case 'dashboardKpiFooterChangeVsAvg':
      return 'Change vs prev month';
    case 'dashboardKpiInsightPurchasesAboveWarn':
      return `${v.base}% — above limit ${v.limit}%`;
    default:
      return key;
  }
}

/** Jan–May sample; index 4 = May, index 3 = April (prior month for May). */
const monthReport = {
  groups: [
    { key: 'sales', months: [100, 100, 100, 100, 176540] },
    { key: 'purchases', months: [50000, 55000, 60000, 65000, 75879] },
    { key: 'expenses', months: [5000, 5500, 6000, 6500, 8615] },
  ],
  summaryRows: [
    { key: 'grossProfit', months: [50000, 45000, 40000, 35000, 100661] },
    { key: 'netProfit', months: [45000, 39500, 34000, 28500, 92046] },
  ],
};

describe('formatInsightPercentDisplay', () => {
  it('uses max one decimal and drops trailing .0', () => {
    expect(formatInsightPercentDisplay(35.5)).toBe('35.5');
    expect(formatInsightPercentDisplay(35)).toBe('35');
  });
});

describe('kpiFooterRowColorClass', () => {
  it('maps color tokens', () => {
    expect(kpiFooterRowColorClass('positive')).toContain('noorix-green');
    expect(kpiFooterRowColorClass('warning')).toContain('noorix-accent-amber');
  });
});

describe('severityFooterValueClass', () => {
  it('maps severities to design-system CSS vars', () => {
    expect(severityFooterValueClass('critical')).toContain('noorix-accent-red');
  });
});

describe('buildKpiInsightFooterMap', () => {
  it('returns empty map when insights failed and no report', () => {
    expect(buildKpiInsightFooterMap(undefined, true, mockT, false)).toEqual({});
  });

  it('builds from report alone — May compares to April only (3 rows)', () => {
    const m = buildKpiInsightFooterMap(undefined, false, mockT, false, monthReport, 5);
    expect(m.purchases?.rows).toHaveLength(3);
    expect(m.purchases?.rows[0]?.value).toBe('43%');
    expect(m.purchases?.rows[1]?.label).toBe('Previous month');
    expect(m.purchases?.rows[1]?.value).toBe('65,000 SR');
    expect(m.purchases?.rows[2]?.label).toBe('Change vs prev month');
    expect(m.purchases?.rows[2]?.value).toBe('+16.7% ↑');
  });

  it('uses API prior-month values when present', () => {
    const payload = {
      ratios: {
        purchaseToSales: 0.43,
        trailingAvgPurchases: 70000,
        purchaseChangeRatio: 0.084,
      },
      warnings: [],
      insights: [],
    } as unknown as DashboardInsightsPayload;

    const m = buildKpiInsightFooterMap(payload, false, mockT, false, monthReport, 5);
    expect(m.purchases?.rows[1]?.value).toContain('70,000');
    expect(m.purchases?.rows[2]?.value).toBe('+8.4% ↑');
  });

  it('purchases: warning ratio color from threshold insight', () => {
    const payload = {
      ratios: { purchaseToSales: 0.42 },
      warnings: [
        {
          id: 'purchase_ratio_to_sales',
          severity: 'warning',
          values: { thresholdWarning: 0.35 },
        },
      ],
      insights: [],
    } as unknown as DashboardInsightsPayload;

    const m = buildKpiInsightFooterMap(payload, false, mockT, false, monthReport, 5);
    expect(m.purchases?.rows[0]?.value).toBe('42%');
    expect(m.purchases?.rows[0]?.color).toBe('warning');
  });

  it('year view shows ratio only when prior month row omitted', () => {
    const payload = {
      ratios: { purchaseToSales: 0.28 },
      warnings: [],
      insights: [],
    } as unknown as DashboardInsightsPayload;

    const m = buildKpiInsightFooterMap(payload, false, mockT, false, monthReport, null);
    expect(m.purchases?.rows).toHaveLength(1);
    expect(m.purchases?.rows[0]?.value).toBe('28%');
  });

  it('January has no prior month in same year', () => {
    const m = buildKpiInsightFooterMap(undefined, false, mockT, false, monthReport, 1);
    expect(m.purchases?.rows[1]?.value).toBe('—');
    expect(m.purchases?.rows[2]?.value).toBe('—');
  });
});
