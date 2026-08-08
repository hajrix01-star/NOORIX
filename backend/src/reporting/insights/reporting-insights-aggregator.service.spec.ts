import type { DashboardSummaryDateRange } from '../reporting.facade';
import { ReportingInsightsAggregatorService } from './reporting-insights-aggregator.service';
import type { DashboardInsightsPayload } from './insights.types';
import type { ExpenseInsightsPayload } from './expenses/expense-insights.types';
import type { PurchaseSupplierInsightsPayload } from './purchases/purchase-supplier-insights.types';
import type { ReportingFacade } from '../reporting.facade';
import type { DashboardInsightsService } from './dashboard-insights.service';
import type { ExpenseInsightsService } from './expenses/expense-insights.service';
import type { PurchaseSupplierInsightsService } from './purchases/purchase-supplier-insights.service';

describe('ReportingInsightsAggregatorService', () => {
  const dateRange: DashboardSummaryDateRange = {
    year: 2026,
    yearStart: '2026-01-01',
    yearEnd: '2026-12-31',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
  };

  function makeDashboardSummaryStub() {
    return {
      profitLoss: {},
      salesPack: {},
      periodAnalytics: {},
    };
  }

  function makeReportingFacadeMock(summary = makeDashboardSummaryStub()): Pick<ReportingFacade, 'getDashboardSummary'> {
    return {
      getDashboardSummary: jest.fn().mockResolvedValue(summary),
    };
  }

  function makeAggregator(params?: {
    summary?: ReturnType<typeof makeDashboardSummaryStub>;
    dashboard?: DashboardInsightsPayload;
    purchases?: PurchaseSupplierInsightsPayload;
    expenses?: ExpenseInsightsPayload;
  }) {
    const facade = makeReportingFacadeMock(params?.summary);
    const dashboardPayload = params?.dashboard ?? makeDashboardPayload();
    const purchasesPayload = params?.purchases ?? makePurchasePayload();
    const expensesPayload = params?.expenses ?? makeExpensePayload();
    const dashboardService: Pick<DashboardInsightsService, 'buildDashboardInsights'> = {
      buildDashboardInsights: jest.fn().mockResolvedValue(dashboardPayload),
    };
    const purchaseService: Pick<PurchaseSupplierInsightsService, 'buildPurchaseSupplierInsights'> = {
      buildPurchaseSupplierInsights: jest.fn().mockResolvedValue(purchasesPayload),
    };
    const expenseService: Pick<ExpenseInsightsService, 'buildExpenseInsights'> = {
      buildExpenseInsights: jest.fn().mockResolvedValue(expensesPayload),
    };
    return {
      facade,
      dashboardService,
      purchaseService,
      expenseService,
      service: new ReportingInsightsAggregatorService(
        facade,
        dashboardService,
        purchaseService,
        expenseService,
      ),
    };
  }

  function makeDashboardPayload(overrides?: Partial<DashboardInsightsPayload>): DashboardInsightsPayload {
    return {
      schemaVersion: 1,
      generatedAt: 'dash-gen',
      context: {
        companyId: 'c1',
        year: 2026,
        selectedMonth: 3,
        labels: {
          profitLossScope: 'accounting_ledger_pl',
          salesPackScope: 'operational_daily_sales_summaries',
          periodAnalyticsScope: 'invoice_aggregates_period',
        },
      },
      metrics: {
        accounting: { sales: null, purchases: null, expenses: null, grossProfit: null, netProfit: null },
        operational: {},
      },
      ratios: { purchaseToSales: null, expenseToSales: null, netProfitMargin: null, notes: [] },
      health: { score: null, band: 'unknown', summaryAr: '', summaryEn: '' },
      insights: [],
      opportunities: [],
      warnings: [],
      ...overrides,
    } as DashboardInsightsPayload;
  }

  function makePurchasePayload(overrides?: Partial<PurchaseSupplierInsightsPayload>): PurchaseSupplierInsightsPayload {
    return {
      schemaVersion: 1,
      generatedAt: 'pur-gen',
      context: {
        companyId: 'c1',
        year: 2026,
        selectedMonth: 3,
        periodStart: dateRange.periodStart,
        periodEnd: dateRange.periodEnd,
        labels: {
          purchaseCategoriesScope: 'invoice_period_purchase_only',
          supplierClassificationScope: 'invoice_period_supplier_counts',
          purchaseCategorySpikeScope: 'accounting_ledger_pl_purchase_categories',
        },
      },
      supplierInsights: [],
      purchaseInsights: [],
      warnings: [],
      ...overrides,
    } as PurchaseSupplierInsightsPayload;
  }

  function makeExpensePayload(overrides?: Partial<ExpenseInsightsPayload>): ExpenseInsightsPayload {
    return {
      schemaVersion: 1,
      generatedAt: 'exp-gen',
      context: {
        companyId: 'c1',
        year: 2026,
        selectedMonth: 3,
        labels: {
          expenseBreakdownScope: 'accounting_ledger_pl_month',
          expenseSpikeScope: 'accounting_ledger_pl_expense_totals',
          fixedExpenseScope: 'invoice_period_recurring_expenses_including_recurring_hr',
        },
      },
      expenseInsights: [],
      warnings: [],
      ...overrides,
    } as ExpenseInsightsPayload;
  }

  it('fetches dashboard summary once and passes the same snapshot to all three builders', async () => {
    const summary = makeDashboardSummaryStub();
    const { facade, dashboardService, purchaseService, expenseService, service } = makeAggregator({ summary });

    const ref = new Date('2026-01-15T12:00:00.000Z');
    await service.getExtendedInsights('c1', dateRange, 3, ref);

    expect(facade.getDashboardSummary).toHaveBeenCalledTimes(1);
    expect(facade.getDashboardSummary).toHaveBeenCalledWith('c1', dateRange);

    expect(dashboardService.buildDashboardInsights).toHaveBeenCalledTimes(1);
    expect(purchaseService.buildPurchaseSupplierInsights).toHaveBeenCalledTimes(1);
    expect(expenseService.buildExpenseInsights).toHaveBeenCalledTimes(1);

    expect(dashboardService.buildDashboardInsights).toHaveBeenCalledWith('c1', dateRange, 3, ref, summary);
    expect(purchaseService.buildPurchaseSupplierInsights).toHaveBeenCalledWith('c1', dateRange, 3, summary);
    expect(expenseService.buildExpenseInsights).toHaveBeenCalledWith('c1', dateRange, 3, summary);
  });

  it('returns schemaVersion 1 and generatedAt', async () => {
    const { service } = makeAggregator();
    const out = await service.getExtendedInsights('c1', dateRange, null);
    expect(out.schemaVersion).toBe(1);
    expect(out.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('includes the three child payloads by reference (unchanged references)', async () => {
    const dash = makeDashboardPayload();
    const pur = makePurchasePayload();
    const exp = makeExpensePayload();
    const { service } = makeAggregator({ dashboard: dash, purchases: pur, expenses: exp });
    const out = await service.getExtendedInsights('c1', dateRange, null);
    expect(out.dashboardInsights).toBe(dash);
    expect(out.purchaseSupplierInsights).toBe(pur);
    expect(out.expenseInsights).toBe(exp);
  });

  it('merges warnings with source, dedupes identical id+metricBasis+category, and sorts by severity then service order', async () => {
    const dup = {
      id: 'dup_rule',
      severity: 'warning' as const,
      category: 'x',
      metricBasis: 'accounting_pl' as const,
      titleAr: 'د',
      titleEn: 'D',
      detailAr: '',
      detailEn: '',
    };
    const dash = makeDashboardPayload({
      warnings: [
        { ...dup, titleEn: 'dash-first' },
        {
          id: 'crit',
          severity: 'critical',
          category: 'c',
          metricBasis: 'accounting_pl',
          titleAr: '',
          titleEn: 'crit',
          detailAr: '',
          detailEn: '',
        },
      ],
    });
    const pur = makePurchasePayload({
      warnings: [
        { ...dup, titleEn: 'pur-dup-skipped' },
        {
          id: 'info_p',
          severity: 'info',
          category: 'i',
          metricBasis: 'invoice_period',
          titleAr: '',
          titleEn: 'info',
          detailAr: '',
          detailEn: '',
        },
      ],
    });
    const exp = makeExpensePayload({
      warnings: [
        {
          id: 'warn_e',
          severity: 'warning',
          category: 'w',
          metricBasis: 'accounting_pl',
          titleAr: '',
          titleEn: 'warn_e',
          detailAr: '',
          detailEn: '',
        },
      ],
    });

    const { service } = makeAggregator({ dashboard: dash, purchases: pur, expenses: exp });
    const out = await service.getExtendedInsights('c1', dateRange, null);

    expect(out.warnings.map((w) => w.id)).toEqual(['crit', 'dup_rule', 'warn_e', 'info_p']);
    expect(out.warnings.map((w) => w.source)).toEqual(['dashboard', 'dashboard', 'expenses', 'purchases']);

    const dupMerged = out.warnings.find((w) => w.id === 'dup_rule');
    expect(dupMerged?.titleEn).toBe('dash-first');
  });

  it('does not mutate original warnings arrays on child payloads', async () => {
    const w1 = {
      id: 'a',
      severity: 'warning' as const,
      category: 'c',
      metricBasis: 'accounting_pl' as const,
      titleAr: '',
      titleEn: '',
      detailAr: '',
      detailEn: '',
    };
    const dashWarnings: typeof w1[] = [w1];
    const dash = makeDashboardPayload({ warnings: dashWarnings });
    const pur = makePurchasePayload({ warnings: [] });
    const exp = makeExpensePayload({ warnings: [] });

    const { service } = makeAggregator({ dashboard: dash, purchases: pur, expenses: exp });
    await service.getExtendedInsights('c1', dateRange, null);

    expect(dash.warnings).toBe(dashWarnings);
    expect(dash.warnings).toEqual([w1]);
    expect('source' in dash.warnings[0]).toBe(false);
  });

  it('handles all-empty warnings', async () => {
    const { service } = makeAggregator();
    const out = await service.getExtendedInsights('c1', dateRange, null);
    expect(out.warnings).toEqual([]);
  });
});
