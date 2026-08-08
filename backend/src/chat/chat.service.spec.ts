import { ChatService } from './chat.service';
import Decimal from 'decimal.js';
import { INSIGHTS_SCHEMA_VERSION } from '../reporting/insights/insights.types';
import type { DashboardInsightsPayload } from '../reporting/insights/insights.types';
import { EXTENDED_REPORTING_INSIGHTS_SCHEMA_VERSION } from '../reporting/insights/reporting-insights-aggregator.types';
import type { ExtendedReportingInsightsPayload } from '../reporting/insights/reporting-insights-aggregator.types';
import { buildDashboardInsightsDateRangeForMonth } from './handlers/dashboard-insights.handler';

type ChatServiceDeps = ConstructorParameters<typeof ChatService>;

function mockDependency<T extends object>(value: object): T {
  return value as T;
}

function mkRatios(overrides: Partial<DashboardInsightsPayload['ratios']> = {}): DashboardInsightsPayload['ratios'] {
  return {
    purchaseToSales: null,
    expenseToSales: null,
    grossProfitMargin: null,
    netProfitMargin: null,
    trailingAvgPurchases: null,
    purchaseChangeRatio: null,
    trailingAvgExpenses: null,
    expenseChangeRatio: null,
    trailingAvgGrossProfit: null,
    grossProfitChangeRatio: null,
    trailingAvgNetProfit: null,
    netProfitChangeRatio: null,
    notes: [],
    ...overrides,
  };
}

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
    ratios: mkRatios(),
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
          fixedExpenseScope: 'invoice_period_recurring_expenses_including_recurring_hr',
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
    const chatFinancialMetrics = {
      sumRevenue: jest.fn().mockResolvedValue(new Decimal(10_000)),
      sumPurchases: jest.fn().mockResolvedValue(new Decimal(2_000)),
      sumOperatingExpenses: jest.fn().mockResolvedValue(new Decimal(1_000)),
      annualSales: jest.fn().mockResolvedValue(new Decimal(1)),
      annualPurchases: jest.fn().mockResolvedValue(new Decimal(2)),
      annualExpenses: jest.fn().mockResolvedValue(new Decimal(3)),
    };
    const chat = new ChatService(
      mockDependency<ChatServiceDeps[0]>(prisma),
      mockDependency<ChatServiceDeps[1]>(reports),
      mockDependency<ChatServiceDeps[2]>(vaults),
      mockDependency<ChatServiceDeps[3]>(dashboard),
      mockDependency<ChatServiceDeps[4]>(reportingInsightsAggregator),
      mockDependency<ChatServiceDeps[5]>(gemini),
      mockDependency<ChatServiceDeps[6]>(chatFinancialMetrics),
    );
    return { chat, prisma, reports, dashboard, reportingInsightsAggregator, gemini, chatFinancialMetrics };
  }

  it('routes كيف وضع الشهر؟ to dashboard insights when Gemini returns dashboard_insights', async () => {
    const { chat, dashboard, reportingInsightsAggregator, gemini, reports } = mkDeps({
      parseIntent: jest.fn().mockResolvedValue({
        intent: 'dashboard_insights',
        period: 'this_month',
        rawQuery: 'كيف وضع الشهر؟',
        confidence: 0.92,
      }),
    });

    const res = await chat.processQuery(companyId, 'كيف وضع الشهر؟', 'owner', undefined);

    expect(gemini.parseIntent).toHaveBeenCalled();
    expect(reportingInsightsAggregator.getExtendedInsights).toHaveBeenCalled();
    expect(dashboard.buildDashboardInsights).toHaveBeenCalled();
    expect(reports.getGeneralProfitLoss).not.toHaveBeenCalled();
    expect(res.meta?.intentSource).toBe('gemini');
    expect(res.meta?.intent).toBe('dashboard_insights');
    expect(res.meta?.intentConfidence).toBe(0.92);
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

  it('answers this-month P&L from period backend metrics without annual cards', async () => {
    const { chat, reports, chatFinancialMetrics } = mkDeps({
      isAvailable: () => false,
      parseIntent: jest.fn(),
    });

    const query =
      '\u0623\u0639\u0637\u0646\u064a \u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0631\u0628\u062d \u0648\u0627\u0644\u062e\u0633\u0627\u0631\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631';
    const res = await chat.processQuery(companyId, query, 'owner', undefined);

    expect(reports.getGeneralProfitLoss).not.toHaveBeenCalled();
    expect(chatFinancialMetrics.sumRevenue).toHaveBeenCalled();
    expect(chatFinancialMetrics.sumPurchases).toHaveBeenCalled();
    expect(chatFinancialMetrics.sumOperatingExpenses).toHaveBeenCalled();
    expect(res.answerAr).toContain('\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0631\u0628\u062d \u0648\u0627\u0644\u062e\u0633\u0627\u0631\u0629');
    expect(res.answerAr).toContain('10000 SR');
    expect(res.answerAr).toContain('7000 SR');
  });

  it('answers explicit month P&L when the user names a month number', async () => {
    const { chat, reports, chatFinancialMetrics } = mkDeps({
      isAvailable: () => false,
      parseIntent: jest.fn(),
    });

    const query =
      '\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0631\u0628\u062d \u0648\u0627\u0644\u062e\u0633\u0627\u0631\u0629 \u0634\u0647\u0631 2 2026';
    const res = await chat.processQuery(companyId, query, 'owner', undefined);

    expect(reports.getGeneralProfitLoss).not.toHaveBeenCalled();
    expect(chatFinancialMetrics.sumRevenue).toHaveBeenCalledWith(
      companyId,
      new Date(2026, 1, 1, 0, 0, 0, 0),
      new Date(2026, 2, 0, 23, 59, 59, 999),
    );
    expect(res.answerAr).toContain('\u0641\u0628\u0631\u0627\u064a\u0631 2026');
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
    expect(res.answerAr).toMatch(/الخارج على المبيعات/);
    expect(dashboard.buildDashboardInsights).not.toHaveBeenCalled();
    expect(reportingInsightsAggregator.getExtendedInsights).not.toHaveBeenCalled();
  });

  it('keeps ready finance ratios answer compact and table-first', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 10, 12, 0, 0));
    try {
      const { chat } = mkDeps({
        isAvailable: () => false,
        parseIntent: jest.fn(),
      });

      const query =
        '\u0646\u0633\u0628 \u0627\u0644\u062e\u0627\u0631\u062c \u0639\u0644\u0649 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a (\u0645\u0634\u062a\u0631\u064a\u0627\u062a\u060c \u0645\u0635\u0631\u0648\u0641\u0627\u062a\u060c \u0627\u0644\u0645\u062c\u0645\u0648\u0639 \u2014 \u062d\u062a\u0649 \u0623\u0645\u0633)';
      const res = await chat.processQuery(companyId, query, 'owner', undefined);

      expect(res.answerAr).toContain('\u0627\u0644\u0628\u0646\u062f\t\u0627\u0644\u0645\u0628\u0644\u063a\t\u0627\u0644\u0646\u0633\u0628\u0629');
      expect(res.answerAr).toContain('\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\t');
      expect(res.answerAr).not.toContain('SR');
      expect(res.answerAr).not.toContain('\u0627\u0644\u062e\u0644\u0627\u0635\u0629');
      expect(res.answerAr).not.toContain('\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644 \u0623\u062f\u0646\u0627\u0647');
      expect(res.answerAr).not.toContain('\u0646\u0633\u0628\u0629 (\u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a + \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a)');
      expect(res.extras?.chart).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
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

  it('uses keyword path when Gemini returns low-confidence rejection', async () => {
    const { chat, gemini, reportingInsightsAggregator } = mkDeps({
      parseIntent: jest.fn().mockResolvedValue({
        intent: 'unknown',
        period: null,
        rawQuery: 'كم بيعنا هذا الشهر',
        confidence: 0.35,
        confidenceRejected: true,
        rejectedModelIntent: 'purchases',
      }),
    });

    const res = await chat.processQuery(companyId, 'كم بيعنا هذا الشهر', 'owner', undefined);

    expect(gemini.parseIntent).toHaveBeenCalled();
    expect(reportingInsightsAggregator.getExtendedInsights).not.toHaveBeenCalled();
    expect(res.meta?.intentSource).toBe('keyword');
    expect(res.meta?.geminiIntentRejected).toBe(true);
    expect(res.meta?.intentConfidence).toBe(0.35);
    expect(res.meta?.geminiSuggestedIntent).toBe('purchases');
    expect(res.answerAr).toMatch(/مبيعات/);
  });

  it('unsupported query response includes bilingual examples', async () => {
    const { chat, gemini } = mkDeps({
      isAvailable: () => false,
      parseIntent: jest.fn(),
    });
    const res = await chat.processQuery(companyId, 'سؤال عشوائي غير مدعوم xyz999nop', 'owner', undefined);
    expect(gemini.parseIntent).not.toHaveBeenCalled();
    expect(res.answerAr).toContain('كيف وضع الشهر');
    expect(res.answerEn).toMatch(/How is the month/i);
    expect(res.answerEn).toMatch(/help/i);
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
      mockDependency<ChatServiceDeps[0]>(prisma),
      mockDependency<ChatServiceDeps[1]>(reports),
      mockDependency<ChatServiceDeps[2]>({}),
      mockDependency<ChatServiceDeps[3]>(dashboard),
      mockDependency<ChatServiceDeps[4]>(reportingInsightsAggregator),
      mockDependency<ChatServiceDeps[5]>(gemini),
      mockDependency<ChatServiceDeps[6]>({
        sumRevenue: jest.fn().mockResolvedValue(new Decimal(10_000)),
        sumPurchases: jest.fn().mockResolvedValue(new Decimal(2_000)),
        sumOperatingExpenses: jest.fn().mockResolvedValue(new Decimal(1_000)),
        annualSales: jest.fn().mockResolvedValue(new Decimal(1)),
        annualPurchases: jest.fn().mockResolvedValue(new Decimal(2)),
        annualExpenses: jest.fn().mockResolvedValue(new Decimal(3)),
      }),
    );
    const res = await chat.processQuery(companyId, 'حلل المشتريات', 'owner', undefined);
    expect(reportingInsightsAggregator.getExtendedInsights).toHaveBeenCalled();
    expect(reports.getGeneralProfitLoss).not.toHaveBeenCalled();
    expect(res.meta?.intent).toBe('dashboard_insights');
    expect(res.meta?.geminiIntent).toBe('purchases');
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
      mockDependency<ChatServiceDeps[0]>(prisma),
      mockDependency<ChatServiceDeps[1]>(reports),
      mockDependency<ChatServiceDeps[2]>({}),
      mockDependency<ChatServiceDeps[3]>(dashboard),
      mockDependency<ChatServiceDeps[4]>(reportingInsightsAggregator),
      mockDependency<ChatServiceDeps[5]>(gemini),
      mockDependency<ChatServiceDeps[6]>({
        sumRevenue: jest.fn().mockResolvedValue(new Decimal(10_000)),
        sumPurchases: jest.fn().mockResolvedValue(new Decimal(2_000)),
        sumOperatingExpenses: jest.fn().mockResolvedValue(new Decimal(1_000)),
        annualSales: jest.fn().mockResolvedValue(new Decimal(1)),
        annualPurchases: jest.fn().mockResolvedValue(new Decimal(2)),
        annualExpenses: jest.fn().mockResolvedValue(new Decimal(3)),
      }),
    );
    const res = await chat.processQuery(companyId, 'حلل المصاريف', 'owner', undefined);
    expect(res.meta?.intent).toBe('dashboard_insights');
    expect(res.meta?.geminiIntent).toBe('expenses');
    expect(res.answerAr).toContain('تنبيه مصاريف');
    expect(reports.getGeneralProfitLoss).not.toHaveBeenCalled();
  });
});
