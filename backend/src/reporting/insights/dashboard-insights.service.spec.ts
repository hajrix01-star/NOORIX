import { mergeInsightThresholds } from './company-insight-thresholds';
import type { GeneralProfitLossModel } from '../../reports/reports-general-profit-loss-model.util';
import type { ReportingFacade } from '../reporting.facade';
import { CompanyInsightThresholdSettingsService } from './company-insight-threshold-settings.service';
import { DashboardInsightsService } from './dashboard-insights.service';
import { INSIGHTS_SCHEMA_VERSION } from './insights.types';

function zeros12(): string[] {
  return Array.from({ length: 12 }, () => '0.00');
}

function fillMonth(
  months: string[],
  idx: number,
  val: string,
): string[] {
  const m = [...months];
  m[idx] = val;
  return m;
}

/** Minimal valid-shaped P&L for one calendar month (idx 0 = January). */
function mockMonthlyPL(params: {
  monthIndex: number;
  sales: string;
  purchases: string;
  expenses: string;
  grossProfit: string;
  netProfit: string;
}): GeneralProfitLossModel {
  const { monthIndex } = params;
  const z = zeros12();
  return {
    months: [],
    groups: [
      {
        key: 'sales',
        labelAr: 'م',
        labelEn: 'S',
        months: fillMonth(z, monthIndex, params.sales),
        total: params.sales,
        percentOfSalesMonths: zeros12(),
        percentOfSalesYear: '0',
        items: [],
      },
      {
        key: 'purchases',
        labelAr: 'م',
        labelEn: 'P',
        months: fillMonth([...z], monthIndex, params.purchases),
        total: params.purchases,
        percentOfSalesMonths: zeros12(),
        percentOfSalesYear: '0',
        items: [],
      },
      {
        key: 'expenses',
        labelAr: 'م',
        labelEn: 'E',
        months: fillMonth([...z], monthIndex, params.expenses),
        total: params.expenses,
        percentOfSalesMonths: zeros12(),
        percentOfSalesYear: '0',
        items: [],
      },
    ],
    summaryRows: [
      {
        key: 'grossProfit',
        labelAr: '',
        labelEn: '',
        months: fillMonth([...z], monthIndex, params.grossProfit),
        total: params.grossProfit,
        percentOfSalesMonths: zeros12(),
        percentOfSalesYear: '0',
      },
      {
        key: 'netProfit',
        labelAr: '',
        labelEn: '',
        months: fillMonth([...z], monthIndex, params.netProfit),
        total: params.netProfit,
        percentOfSalesMonths: zeros12(),
        percentOfSalesYear: '0',
      },
    ],
    cards: {
      sales: params.sales,
      purchases: params.purchases,
      expenses: params.expenses,
      grossProfit: params.grossProfit,
      netProfit: params.netProfit,
    },
  };
}

const baseDr = {
  year: 2024,
  yearStart: '2024-01-01',
  yearEnd: '2024-12-31',
  dailyStart: '2024-03-01',
  dailyEnd: '2024-03-31',
  monthStart: '2024-03-01',
  monthEnd: '2024-03-31',
  periodStart: '2024-03-01',
  periodEnd: '2024-03-31',
};

describe('DashboardInsightsService', () => {
  const companyId = 'test-co-id';

  const mkThresholdSettings = () => ({
    getResolvedThresholds: jest.fn().mockImplementation(() => Promise.resolve(mergeInsightThresholds(undefined))),
  });

  const mkFacade = () => ({
    getDashboardSummary: jest.fn(),
  });

  it('calls ReportingFacade.getDashboardSummary exactly once', async () => {
    const facade = mkFacade();
    const th = mkThresholdSettings();
    const pl = mockMonthlyPL({
      monthIndex: 2,
      sales: '10000.00',
      purchases: '2000.00',
      expenses: '2000.00',
      grossProfit: '8000.00',
      netProfit: '6000.00',
    });
    facade.getDashboardSummary.mockResolvedValue({
      profitLoss: pl,
      salesPack: { dailySummaries: [{ transactionDate: '2024-03-10', totalAmount: '100' }] },
      periodAnalytics: {},
    });

    const svc = new DashboardInsightsService(
      facade as unknown as ReportingFacade,
      th as unknown as CompanyInsightThresholdSettingsService,
    );
    await svc.buildDashboardInsights(companyId, baseDr, 3, new Date('2024-06-01'));
    expect(th.getResolvedThresholds).toHaveBeenCalledWith(companyId);
    expect(facade.getDashboardSummary).toHaveBeenCalledTimes(1);
    expect(facade.getDashboardSummary).toHaveBeenCalledWith(companyId, baseDr);
  });

  it('returns schemaVersion 1 and preserves accounting strings', async () => {
    const facade = mkFacade();
    const pl = mockMonthlyPL({
      monthIndex: 2,
      sales: '10000.00',
      purchases: '2000.00',
      expenses: '2000.00',
      grossProfit: '8000.00',
      netProfit: '6000.00',
    });
    facade.getDashboardSummary.mockResolvedValue({
      profitLoss: pl,
      salesPack: { dailySummaries: [{ transactionDate: '2024-03-05', totalAmount: '50' }] },
      periodAnalytics: {},
    });

    const svc = new DashboardInsightsService(
      facade as unknown as ReportingFacade,
      mkThresholdSettings() as unknown as CompanyInsightThresholdSettingsService,
    );
    const out = await svc.buildDashboardInsights(companyId, baseDr, 3, new Date('2024-06-01'));
    expect(out.schemaVersion).toBe(INSIGHTS_SCHEMA_VERSION);
    expect(out.metrics.accounting.sales).toBe('10000.00');
    expect(out.metrics.accounting.netProfit).toBe('6000.00');
  });

  it('profitable month: ratios computed, band green', async () => {
    const facade = mkFacade();
    facade.getDashboardSummary.mockResolvedValue({
      profitLoss: mockMonthlyPL({
        monthIndex: 2,
        sales: '10000.00',
        purchases: '2000.00',
        expenses: '2000.00',
        grossProfit: '8000.00',
        netProfit: '6000.00',
      }),
      salesPack: { dailySummaries: [{ transactionDate: '2024-03-01', totalAmount: '1000' }] },
      periodAnalytics: {},
    });

    const svc = new DashboardInsightsService(
      facade as unknown as ReportingFacade,
      mkThresholdSettings() as unknown as CompanyInsightThresholdSettingsService,
    );
    const out = await svc.buildDashboardInsights(companyId, baseDr, 3, new Date('2024-06-01'));
    expect(out.ratios.purchaseToSales).toBeCloseTo(0.2, 5);
    expect(out.ratios.expenseToSales).toBeCloseTo(0.2, 5);
    expect(out.ratios.netProfitMargin).toBeCloseTo(0.6, 5);
    expect(out.health.band).toBe('green');
    expect(out.warnings).toHaveLength(0);
  });

  it('loss month: negative profit warnings', async () => {
    const facade = mkFacade();
    facade.getDashboardSummary.mockResolvedValue({
      profitLoss: mockMonthlyPL({
        monthIndex: 2,
        sales: '5000.00',
        purchases: '3000.00',
        expenses: '4000.00',
        grossProfit: '2000.00',
        netProfit: '-500.00',
      }),
      salesPack: { dailySummaries: [{ transactionDate: '2024-03-02', totalAmount: '100' }] },
      periodAnalytics: {},
    });

    const svc = new DashboardInsightsService(
      facade as unknown as ReportingFacade,
      mkThresholdSettings() as unknown as CompanyInsightThresholdSettingsService,
    );
    const out = await svc.buildDashboardInsights(companyId, baseDr, 3, new Date('2024-06-01'));
    const ids = out.warnings.map((w) => w.id);
    expect(ids).toContain('negative_profit_warning');
    expect(ids).toContain('net_profit_margin');
    expect(out.health.band).toBe('red');
  });

  it('high purchases month: purchase_ratio_to_sales warning', async () => {
    const facade = mkFacade();
    facade.getDashboardSummary.mockResolvedValue({
      profitLoss: mockMonthlyPL({
        monthIndex: 2,
        sales: '10000.00',
        purchases: '7000.00',
        expenses: '1000.00',
        grossProfit: '3000.00',
        netProfit: '2000.00',
      }),
      salesPack: { dailySummaries: [{ transactionDate: '2024-03-01', totalAmount: '10' }] },
      periodAnalytics: {},
    });

    const svc = new DashboardInsightsService(
      facade as unknown as ReportingFacade,
      mkThresholdSettings() as unknown as CompanyInsightThresholdSettingsService,
    );
    const out = await svc.buildDashboardInsights(companyId, baseDr, 3, new Date('2024-06-01'));
    expect(out.warnings.some((w) => w.id === 'purchase_ratio_to_sales')).toBe(true);
    expect(out.ratios.purchaseToSales).toBeCloseTo(0.7, 5);
  });

  it('high expenses month: expense_ratio_to_sales critical at 0.5', async () => {
    const facade = mkFacade();
    facade.getDashboardSummary.mockResolvedValue({
      profitLoss: mockMonthlyPL({
        monthIndex: 2,
        sales: '10000.00',
        purchases: '2000.00',
        expenses: '5000.00',
        grossProfit: '8000.00',
        netProfit: '3000.00',
      }),
      salesPack: { dailySummaries: [{ transactionDate: '2024-03-01', totalAmount: '10' }] },
      periodAnalytics: {},
    });

    const svc = new DashboardInsightsService(
      facade as unknown as ReportingFacade,
      mkThresholdSettings() as unknown as CompanyInsightThresholdSettingsService,
    );
    const out = await svc.buildDashboardInsights(companyId, baseDr, 3, new Date('2024-06-01'));
    const expRule = out.warnings.find((w) => w.id === 'expense_ratio_to_sales');
    expect(expRule?.severity).toBe('critical');
    expect(out.ratios.expenseToSales).toBeCloseTo(0.5, 5);
  });

  it('v1: does not emit missing_sales_data_warning when operational pack empty but accounting sales exist', async () => {
    const facade = mkFacade();
    facade.getDashboardSummary.mockResolvedValue({
      profitLoss: mockMonthlyPL({
        monthIndex: 2,
        sales: '1000.00',
        purchases: '100.00',
        expenses: '100.00',
        grossProfit: '900.00',
        netProfit: '800.00',
      }),
      salesPack: { dailySummaries: [] },
      periodAnalytics: {},
    });

    const svc = new DashboardInsightsService(
      facade as unknown as ReportingFacade,
      mkThresholdSettings() as unknown as CompanyInsightThresholdSettingsService,
    );
    const out = await svc.buildDashboardInsights(companyId, baseDr, 3, new Date('2024-06-01'));
    expect(out.metrics.operational.activeSalesDaysInMonth).toBe(0);
    expect(out.warnings.some((w) => w.id === 'missing_sales_data_warning')).toBe(false);
  });

  it('v1: empty operational daily summaries never add missing_sales_data_warning', async () => {
    const facade = mkFacade();
    facade.getDashboardSummary.mockResolvedValue({
      profitLoss: mockMonthlyPL({
        monthIndex: 2,
        sales: '5000.00',
        purchases: '1000.00',
        expenses: '500.00',
        grossProfit: '4000.00',
        netProfit: '3500.00',
      }),
      salesPack: { dailySummaries: [], monthSummaries: [] },
      periodAnalytics: {},
    });

    const svc = new DashboardInsightsService(
      facade as unknown as ReportingFacade,
      mkThresholdSettings() as unknown as CompanyInsightThresholdSettingsService,
    );
    const out = await svc.buildDashboardInsights(companyId, baseDr, 3, new Date('2024-06-01'));
    expect(out.warnings.every((w) => w.id !== 'missing_sales_data_warning')).toBe(true);
  });

  it('near-zero sales denominator: ratios null with notes', async () => {
    const facade = mkFacade();
    facade.getDashboardSummary.mockResolvedValue({
      profitLoss: mockMonthlyPL({
        monthIndex: 2,
        sales: '0.00',
        purchases: '100.00',
        expenses: '50.00',
        grossProfit: '-100.00',
        netProfit: '-150.00',
      }),
      salesPack: { dailySummaries: [{ transactionDate: '2024-03-01', totalAmount: '0' }] },
      periodAnalytics: {},
    });

    const svc = new DashboardInsightsService(
      facade as unknown as ReportingFacade,
      mkThresholdSettings() as unknown as CompanyInsightThresholdSettingsService,
    );
    const out = await svc.buildDashboardInsights(companyId, baseDr, 3, new Date('2024-06-01'));
    expect(out.ratios.purchaseToSales).toBeNull();
    expect(out.ratios.expenseToSales).toBeNull();
    expect(out.ratios.netProfitMargin).toBeNull();
    expect(out.ratios.notes.some((n) => /near zero/i.test(n))).toBe(true);
  });

  it('missing profitLoss does not throw', async () => {
    const facade = mkFacade();
    facade.getDashboardSummary.mockResolvedValue({
      profitLoss: undefined,
      salesPack: {},
      periodAnalytics: {},
    });

    const svc = new DashboardInsightsService(
      facade as unknown as ReportingFacade,
      mkThresholdSettings() as unknown as CompanyInsightThresholdSettingsService,
    );
    const out = await svc.buildDashboardInsights(companyId, baseDr, 3, new Date('2024-06-01'));
    expect(out.metrics.accounting.sales).toBeNull();
    expect(out.ratios.purchaseToSales).toBeNull();
  });

  it('uses custom resolved thresholds for purchase ratio (suppresses warning when bands raised)', async () => {
    const facade = mkFacade();
    facade.getDashboardSummary.mockResolvedValue({
      profitLoss: mockMonthlyPL({
        monthIndex: 2,
        sales: '10000.00',
        purchases: '7000.00',
        expenses: '1000.00',
        grossProfit: '3000.00',
        netProfit: '2000.00',
      }),
      salesPack: { dailySummaries: [{ transactionDate: '2024-03-01', totalAmount: '10' }] },
      periodAnalytics: {},
    });

    const th = {
      getResolvedThresholds: jest
        .fn()
        .mockResolvedValue(mergeInsightThresholds({ purchaseToSales: { warning: 0.75, critical: 0.85 } })),
    };
    const svc = new DashboardInsightsService(
      facade as unknown as ReportingFacade,
      th as unknown as CompanyInsightThresholdSettingsService,
    );
    const out = await svc.buildDashboardInsights(companyId, baseDr, 3, new Date('2024-06-01'));
    expect(out.ratios.purchaseToSales).toBeCloseTo(0.7, 5);
    expect(out.warnings.some((w) => w.id === 'purchase_ratio_to_sales')).toBe(false);
  });

  it('falls back to generic thresholds when settings service returns merged defaults only', async () => {
    const facade = mkFacade();
    facade.getDashboardSummary.mockResolvedValue({
      profitLoss: mockMonthlyPL({
        monthIndex: 2,
        sales: '10000.00',
        purchases: '7000.00',
        expenses: '1000.00',
        grossProfit: '3000.00',
        netProfit: '2000.00',
      }),
      salesPack: { dailySummaries: [{ transactionDate: '2024-03-01', totalAmount: '10' }] },
      periodAnalytics: {},
    });

    const th = mkThresholdSettings();
    const svc = new DashboardInsightsService(
      facade as unknown as ReportingFacade,
      th as unknown as CompanyInsightThresholdSettingsService,
    );
    const out = await svc.buildDashboardInsights(companyId, baseDr, 3, new Date('2024-06-01'));
    expect(th.getResolvedThresholds).toHaveBeenCalledWith(companyId);
    expect(out.warnings.some((w) => w.id === 'purchase_ratio_to_sales')).toBe(true);
  });
});
