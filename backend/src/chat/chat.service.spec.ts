import { ChatService } from './chat.service';
import { INSIGHTS_SCHEMA_VERSION } from '../reporting/insights/insights.types';
import type { DashboardInsightsPayload } from '../reporting/insights/insights.types';
import { EXTENDED_REPORTING_INSIGHTS_SCHEMA_VERSION } from '../reporting/insights/reporting-insights-aggregator.types';
import type { ExtendedReportingInsightsPayload } from '../reporting/insights/reporting-insights-aggregator.types';
import { buildDashboardInsightsDateRangeForMonth } from './handlers/dashboard-insights.handler';

function mkInsightsPayload(): DashboardInsightsPayload {
  return {
    schemaVersion: INSIGHTS_SCHEMA_VERSION,
    generatedAt: '2024-03-15T12:00:00.000Z',
    context: {
      companyId: 'c1',
      year: 2024,
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
    health: {
      score: 60,
      band: 'amber',
      summaryAr: 'ملخص صحة من الخدمة.',
      summaryEn: 'Health summary from service.',
    },
    insights: [],
    opportunities: [],
    warnings: [],
  };
}

function mkExtendedFromDashboardForChat(dash: DashboardInsightsPayload): ExtendedReportingInsightsPayload {
  const { companyId, year, selectedMonth } = dash.context;
  const sm = selectedMonth ?? 3;
  const dr = buildDashboardInsightsDateRangeForMonth(year, sm);
  return {
    schemaVersion: EXTENDED_REPORTING_INSIGHTS_SCHEMA_VERSION,
    generatedAt: dash.generatedAt,
    context: {
      companyId,
      year,
      selectedMonth: sm,
      periodStart: dr.periodStart,
      periodEnd: dr.periodEnd,
      labels: { dashboard: 'd', purchases: 'p', expenses: 'e' },
    },
    dashboardInsights: dash,
    purchaseSupplierInsights: {
      schemaVersion: 1,
      generatedAt: '',
      context: {
        companyId,
        year,
        selectedMonth: sm,
        periodStart: dr.periodStart,
        periodEnd: dr.periodEnd,
        labels: {
          purchaseCategoriesScope: 'invoice_period_purchase_only',
          supplierClassificationScope: 'invoice_period_supplier_counts',
          purchaseCategorySpikeScope: 'accounting_ledger_pl_purchase_categories',
        },
      },
      supplierInsights: [],
      purchaseInsights: [],
      warnings: [],
    },
    expenseInsights: {
      schemaVersion: 1,
      generatedAt: '',
      context: {
        companyId,
        year,
        selectedMonth: sm,
        labels: {
          expenseBreakdownScope: 'accounting_ledger_pl_month',
          expenseSpikeScope: 'accounting_ledger_pl_expense_totals',
          fixedExpenseScope: 'accounting_ledger_pl_kind_fixed_expense',
        },
      },
      expenseInsights: [],
      warnings: [],
    },
    warnings: dash.warnings.map((w) => ({ ...w, source: 'dashboard' as const })),
  };
}

describe('ChatService intent routing', () => {
  const companyId = 'c1';

  function mkDeps(geminiOverrides: { isAvailable?: () => boolean; parseIntent?: jest.Mock }) {
    const prisma = {
      ledgerEntry: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 10_000 } }),
      },
    };
    const reports = {
      getGeneralProfitLoss: jest.fn().mockResolvedValue({
        cards: { sales: '1', purchases: '2', expenses: '3', grossProfit: '4', netProfit: '5' },
      }),
    };
    const vaults = {};
    const dashboard = { buildDashboardInsights: jest.fn().mockResolvedValue(mkInsightsPayload()) };
    const reportingInsightsAggregator = {
      getExtendedInsights: jest.fn().mockImplementation(async (cid: string, dr: unknown, sm: number, ref: Date) => {
        const dash = await dashboard.buildDashboardInsights(cid, dr, sm, ref);
        return mkExtendedFromDashboardForChat(dash);
      }),
    };
    const gemini = {
      isAvailable: geminiOverrides.isAvailable ?? (() => true),
      parseIntent: geminiOverrides.parseIntent ?? jest.fn().mockResolvedValue(null),
      explainDashboardInsights: jest.fn(),
    };
    const chat = new ChatService(
      prisma as any,
      reports as any,
      vaults as any,
      dashboard as any,
      reportingInsightsAggregator as any,
      gemini as any,
    );
    return { chat, prisma, reports, dashboard, reportingInsightsAggregator, gemini };
  }

  it('routes كيف وضع الشهر؟ to dashboard insights when Gemini returns dashboard_insights', async () => {
    const { chat, dashboard, reportingInsightsAggregator, gemini, reports } = mkDeps({
      parseIntent: jest.fn().mockResolvedValue({
        intent: 'dashboard_insights',
        period: 'this_month',
        rawQuery: 'كيف وضع الشهر؟',
      }),
    });

    const res = await chat.processQuery(companyId, 'كيف وضع الشهر؟', 'owner', undefined);

    expect(gemini.parseIntent).toHaveBeenCalled();
    expect(reportingInsightsAggregator.getExtendedInsights).toHaveBeenCalled();
    expect(dashboard.buildDashboardInsights).toHaveBeenCalled();
    expect(reports.getGeneralProfitLoss).not.toHaveBeenCalled();
    expect(res.meta?.intentSource).toBe('gemini');
    expect(res.meta?.intent).toBe('dashboard_insights');
  });

  it('routes formal P&L wording to reports when Gemini returns reports', async () => {
    const { chat, dashboard, reportingInsightsAggregator, reports } = mkDeps({
      parseIntent: jest.fn().mockResolvedValue({
        intent: 'reports',
        period: 'year',
        rawQuery: 'تقرير الأرباح والخسائر',
      }),
    });

    const res = await chat.processQuery(companyId, 'تقرير الأرباح والخسائر', 'owner', undefined);

    expect(reports.getGeneralProfitLoss).toHaveBeenCalled();
    expect(dashboard.buildDashboardInsights).not.toHaveBeenCalled();
    expect(reportingInsightsAggregator.getExtendedInsights).not.toHaveBeenCalled();
    expect(res.meta?.intent).toBe('reports');
    expect(res.answerAr).toMatch(/ملخص الربح والخسارة/);
  });

  it('routes نسبة المشتريات من المبيعات to finance ratios when Gemini returns finance_ratios', async () => {
    const { chat, dashboard, reportingInsightsAggregator } = mkDeps({
      parseIntent: jest.fn().mockResolvedValue({
        intent: 'finance_ratios',
        period: null,
        rawQuery: 'نسبة المشتريات من المبيعات',
      }),
    });

    const res = await chat.processQuery(companyId, 'نسبة المشتريات من المبيعات', 'owner', undefined);

    expect(res.meta?.intent).toBe('finance_ratios');
    expect(res.answerAr).toMatch(/مؤشرات الخارج على المبيعات/);
    expect(dashboard.buildDashboardInsights).not.toHaveBeenCalled();
    expect(reportingInsightsAggregator.getExtendedInsights).not.toHaveBeenCalled();
  });

  it('keyword fallback still handles month status when Gemini is unavailable', async () => {
    const { chat, dashboard, reportingInsightsAggregator, gemini } = mkDeps({
      isAvailable: () => false,
      parseIntent: jest.fn(),
    });

    const res = await chat.processQuery(companyId, 'كيف وضع الشهر؟', 'owner', undefined);

    expect(gemini.parseIntent).not.toHaveBeenCalled();
    expect(reportingInsightsAggregator.getExtendedInsights).toHaveBeenCalled();
    expect(dashboard.buildDashboardInsights).toHaveBeenCalled();
    expect(res.meta?.intentSource).toBe('keyword');
  });

  it('does not call dashboard insights when Gemini returns reports for profit and loss report', async () => {
    const { chat, dashboard, reportingInsightsAggregator } = mkDeps({
      parseIntent: jest.fn().mockResolvedValue({ intent: 'reports', period: null, rawQuery: 'x' }),
    });
    await chat.processQuery(companyId, 'profit and loss report', 'owner', undefined);
    expect(dashboard.buildDashboardInsights).not.toHaveBeenCalled();
    expect(reportingInsightsAggregator.getExtendedInsights).not.toHaveBeenCalled();
  });

  it('remaps Gemini purchases to dashboard_insights for حلل المشتريات and returns insight text (not year KPI line)', async () => {
    const prisma = {
      ledgerEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    };
    const reports = { getGeneralProfitLoss: jest.fn() };
    const dash = mkInsightsPayload();
    dash.warnings = [
      {
        id: 'purchase_ratio_to_sales',
        severity: 'warning',
        category: 'purchases',
        metricBasis: 'accounting_pl',
        titleAr: 'تنبيه نسبة المشتريات للمبيعات',
        titleEn: 'Purchase ratio alert',
        detailAr: 'تفاصيل من الرؤى.',
        detailEn: 'Insight details.',
      },
    ];
    const dashboard = { buildDashboardInsights: jest.fn().mockResolvedValue(dash) };
    const reportingInsightsAggregator = {
      getExtendedInsights: jest.fn().mockImplementation(async (cid: string, dr: unknown, sm: number, ref: Date) => {
        const d = await dashboard.buildDashboardInsights(cid, dr, sm, ref);
        return mkExtendedFromDashboardForChat(d);
      }),
    };
    const gemini = {
      isAvailable: () => true,
      parseIntent: jest.fn().mockResolvedValue({
        intent: 'purchases',
        period: null,
        rawQuery: 'حلل المشتريات',
      }),
      explainDashboardInsights: jest.fn(),
    };
    const chat = new ChatService(
      prisma as any,
      reports as any,
      {} as any,
      dashboard as any,
      reportingInsightsAggregator as any,
      gemini as any,
    );
    const res = await chat.processQuery(companyId, 'حلل المشتريات', 'owner', undefined);
    expect(reportingInsightsAggregator.getExtendedInsights).toHaveBeenCalled();
    expect(reports.getGeneralProfitLoss).not.toHaveBeenCalled();
    expect(res.meta?.intent).toBe('dashboard_insights');
    expect(res.answerAr).toContain('تنبيه نسبة المشتريات');
    expect(res.answerAr).not.toMatch(/مشتريات السنة/);
    const combined = `${res.answerAr}\n${res.answerEn}`;
    expect(combined).not.toContain('schemaVersion');
    expect(combined).not.toContain('dashboardInsights');
  });

  it('remaps Gemini expenses to dashboard_insights for حلل المصاريف', async () => {
    const prisma = { ledgerEntry: { aggregate: jest.fn() } };
    const reports = { getGeneralProfitLoss: jest.fn() };
    const dash = mkInsightsPayload();
    dash.warnings = [
      {
        id: 'expense_ratio_to_sales',
        severity: 'warning',
        category: 'expenses',
        metricBasis: 'accounting_pl',
        titleAr: 'تنبيه مصاريف',
        titleEn: 'Expense alert',
        detailAr: 'x',
        detailEn: 'x',
      },
    ];
    const dashboard = { buildDashboardInsights: jest.fn().mockResolvedValue(dash) };
    const reportingInsightsAggregator = {
      getExtendedInsights: jest.fn().mockImplementation(async (cid: string, dr: unknown, sm: number, ref: Date) => {
        const d = await dashboard.buildDashboardInsights(cid, dr, sm, ref);
        return mkExtendedFromDashboardForChat(d);
      }),
    };
    const gemini = {
      isAvailable: () => true,
      parseIntent: jest.fn().mockResolvedValue({ intent: 'expenses', period: null, rawQuery: 'حلل المصاريف' }),
      explainDashboardInsights: jest.fn(),
    };
    const chat = new ChatService(
      prisma as any,
      reports as any,
      {} as any,
      dashboard as any,
      reportingInsightsAggregator as any,
      gemini as any,
    );
    const res = await chat.processQuery(companyId, 'حلل المصاريف', 'owner', undefined);
    expect(res.meta?.intent).toBe('dashboard_insights');
    expect(res.answerAr).toContain('تنبيه مصاريف');
    expect(reports.getGeneralProfitLoss).not.toHaveBeenCalled();
  });
});
