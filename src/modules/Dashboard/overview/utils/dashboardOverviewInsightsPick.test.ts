import { describe, it, expect } from 'vitest';
import { pickDashboardInsightDisplayItems } from './dashboardOverviewInsightsPick';
import type { DashboardInsightsPayload } from '../../../../services/reportingInsightsApi';

describe('pickDashboardInsightDisplayItems', () => {
  it('puts warnings before insights and caps at 5', () => {
    const mk = (id: string, basis: 'accounting_pl') => ({
      id,
      severity: 'warning' as const,
      category: 'x',
      metricBasis: basis,
      titleAr: 'ع',
      titleEn: 't',
      detailAr: 'د',
      detailEn: 'd',
    });
    const payload = {
      warnings: [mk('w1', 'accounting_pl')],
      insights: [mk('i1', 'accounting_pl'), mk('i2', 'accounting_pl')],
    } as unknown as DashboardInsightsPayload;

    const rows = pickDashboardInsightDisplayItems(payload);
    expect(rows.map((r) => r.id)).toEqual(['w1', 'i1', 'i2']);
  });

  it('returns empty when payload missing', () => {
    expect(pickDashboardInsightDisplayItems(undefined)).toEqual([]);
  });
});
