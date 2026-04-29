import type { GeneralProfitLossModel } from '../../../reports/reports-general-profit-loss-model.util';
import { PurchaseSupplierInsightsService } from './purchase-supplier-insights.service';
import type { DashboardSummaryDateRange } from '../../reporting.facade';

describe('PurchaseSupplierInsightsService', () => {
  const dateRange: DashboardSummaryDateRange = {
    year: 2026,
    yearStart: '2026-01-01',
    yearEnd: '2026-12-31',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
  };

  it('calls ReportingFacade.getDashboardSummary exactly once', async () => {
    const summary = {
      profitLoss: null,
      salesPack: {},
      periodAnalytics: {
        purchaseCategoryBreakdown: [],
        purchaseCategoryTotal: '0',
        supplierCategoryBreakdown: [],
        suppliersInPeriodCount: 0,
      },
    };
    const getDashboardSummary = jest.fn().mockResolvedValue(summary);
    const facade = { getDashboardSummary } as unknown as import('../../reporting.facade').ReportingFacade;
    const svc = new PurchaseSupplierInsightsService(facade);
    await svc.buildPurchaseSupplierInsights('c1', dateRange, null);
    expect(getDashboardSummary).toHaveBeenCalledTimes(1);
    expect(getDashboardSummary).toHaveBeenCalledWith('c1', dateRange);
  });

  it('returns schemaVersion 1, generatedAt, and stable warning order', async () => {
    const breakdown = [
      { categoryId: 'a', nameAr: 'A', nameEn: 'A', amount: '60.0000' },
      { categoryId: 'b', nameAr: 'B', nameEn: 'B', amount: '15.0000' },
      { categoryId: null, nameAr: 'غير مصنّف', nameEn: 'Uncategorized', amount: '25.0000' },
    ];
    const m = Array.from({ length: 12 }, () => '0');
    m[1] = '10';
    m[2] = '10';
    m[3] = '100';
    const pl: GeneralProfitLossModel = {
      months: [],
      groups: [
        {
          key: 'purchases',
          labelAr: 'p',
          labelEn: 'p',
          months: Array(12).fill('0'),
          total: '0',
          percentOfSalesMonths: Array(12).fill('0'),
          percentOfSalesYear: '0',
          items: [
            {
              key: 'category:x',
              labelAr: 'X',
              labelEn: 'X',
              months: [...m],
              total: '0',
              percentOfSalesMonths: Array(12).fill('0'),
              percentOfSalesYear: '0',
            },
          ],
        },
      ],
      summaryRows: [],
      cards: { sales: '0', purchases: '0', expenses: '0', grossProfit: '0', netProfit: '0' },
    };
    const getDashboardSummary = jest.fn().mockResolvedValue({
      profitLoss: pl,
      salesPack: {},
      periodAnalytics: {
        purchaseCategoryBreakdown: breakdown,
        purchaseCategoryTotal: '100.0000',
        supplierCategoryBreakdown: [
          { categoryId: 'c1', nameAr: 'C', nameEn: 'C', count: 2 },
          { categoryId: null, nameAr: 'غير مصنّف', nameEn: 'Uncategorized', count: 1 },
        ],
        suppliersInPeriodCount: 3,
      },
    });
    const facade = { getDashboardSummary } as unknown as import('../../reporting.facade').ReportingFacade;
    const svc = new PurchaseSupplierInsightsService(facade);
    const out = await svc.buildPurchaseSupplierInsights('c1', dateRange, 4);
    expect(out.schemaVersion).toBe(1);
    expect(out.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(out.warnings.map((w) => w.id)).toEqual([
      'purchase_category_concentration_warning',
      'purchase_uncategorized_share_warning',
      'missing_supplier_breakdown_warning',
      'purchase_category_spike_warning',
    ]);
  });

  it('does not crash when periodAnalytics or profitLoss fields are missing', async () => {
    const getDashboardSummary = jest.fn().mockResolvedValue({
      profitLoss: undefined,
      salesPack: {},
      periodAnalytics: undefined,
    });
    const facade = { getDashboardSummary } as unknown as import('../../reporting.facade').ReportingFacade;
    const svc = new PurchaseSupplierInsightsService(facade);
    const out = await svc.buildPurchaseSupplierInsights('c1', dateRange, null);
    expect(out.warnings).toEqual([]);
  });
});
