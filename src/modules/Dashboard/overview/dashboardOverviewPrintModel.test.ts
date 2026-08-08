import { buildDashboardOverviewPrintDocument } from './dashboardOverviewPrintModel';
import { describe, expect, it } from 'vitest';

const t = (key: string) => key;

describe('buildDashboardOverviewPrintDocument', () => {
  it('builds an A4 portrait overview and limits detail rows to preserve one page', () => {
    const doc = buildDashboardOverviewPrintDocument({
      companyName: 'ARZ',
      year: 2026,
      lang: 'ar',
      t,
      kpiCardsByKey: new Map([
        ['sales', { key: 'sales', value: 1000, pct: 100, tone: 'positive' }],
        ['purchases', { key: 'purchases', value: 100, pct: 10, tone: 'cost' }],
        ['expenses', { key: 'expenses', value: 50, pct: 5, tone: 'cost' }],
        ['grossProfit', { key: 'grossProfit', value: 900, pct: 90, tone: 'positive' }],
        ['netProfit', { key: 'netProfit', value: 850, pct: 85, tone: 'positive' }],
      ]),
      vaultActivity: {
        totalInflow: 1000, totalOutflow: 150, periodResult: 850, transferVolume: 0,
        rows: Array.from({ length: 9 }, (_, index) => ({
          vaultId: `vault-${index}`, nameAr: `خزينة ${index}`, type: 'cash', isArchived: false,
          inflow: 100, outflow: 10, periodResult: 90, inflowSharePct: 10, transferIn: 0, transferOut: 0,
        })),
      },
      operationalOverview: {
        sales: 1000,
        recurringCosts: {
          amount: 50, recordCount: 6, shareOfSalesPct: 5,
          categories: Array.from({ length: 6 }, (_, index) => ({ id: `recurring-${index}`, nameAr: `دوري ${index}`, amount: 10, sharePct: 1 })),
        },
        otherExpenses: {
          amount: 30, shareOfSalesPct: 3,
          categories: Array.from({ length: 6 }, (_, index) => ({ id: `other-${index}`, nameAr: `أخرى ${index}`, amount: 5, sharePct: 1 })),
        },
        purchases: {
          amount: 100, shareOfSalesPct: 10,
          categories: Array.from({ length: 7 }, (_, index) => ({ nameAr: `فئة ${index}`, amount: 10, sharePct: 1 })),
        },
        operatingCosts: { amount: 180, shareOfSalesPct: 18 },
      },
    });

    expect(doc.landscape).toBe(false);
    expect(doc.pageMarginMm).toBe(8);
    expect(doc.showPageCounter).toBe(false);
    expect(doc.extraCss).toContain('max-height:270mm');
    expect(doc.body).toContain('+1 عناصر إضافية غير معروضة للحفاظ على صفحة واحدة');
    expect(doc.body).toContain('خزينة 7');
    expect(doc.body).not.toContain('خزينة 8');
  });
});
