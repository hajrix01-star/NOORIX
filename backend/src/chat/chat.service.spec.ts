import { ChatService } from './chat.service';
import { INSIGHTS_SCHEMA_VERSION } from '../reporting/insights/insights.types';
import type { DashboardInsightsPayload } from '../reporting/insights/insights.types';

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
    const gemini = {
      isAvailable: geminiOverrides.isAvailable ?? (() => true),
      parseIntent: geminiOverrides.parseIntent ?? jest.fn().mockResolvedValue(null),
      explainDashboardInsights: jest.fn(),
    };
    const chat = new ChatService(prisma as any, reports as any, vaults as any, dashboard as any, gemini as any);
    return { chat, prisma, reports, dashboard, gemini };
  }

  it('routes كيف وضع الشهر؟ to dashboard insights when Gemini returns dashboard_insights', async () => {
    const { chat, dashboard, gemini, reports } = mkDeps({
      parseIntent: jest.fn().mockResolvedValue({
        intent: 'dashboard_insights',
        period: 'this_month',
        rawQuery: 'كيف وضع الشهر؟',
      }),
    });

    const res = await chat.processQuery(companyId, 'كيف وضع الشهر؟', 'owner', undefined);

    expect(gemini.parseIntent).toHaveBeenCalled();
    expect(dashboard.buildDashboardInsights).toHaveBeenCalled();
    expect(reports.getGeneralProfitLoss).not.toHaveBeenCalled();
    expect(res.meta?.intentSource).toBe('gemini');
    expect(res.meta?.intent).toBe('dashboard_insights');
  });

  it('routes formal P&L wording to reports when Gemini returns reports', async () => {
    const { chat, dashboard, reports } = mkDeps({
      parseIntent: jest.fn().mockResolvedValue({
        intent: 'reports',
        period: 'year',
        rawQuery: 'تقرير الأرباح والخسائر',
      }),
    });

    const res = await chat.processQuery(companyId, 'تقرير الأرباح والخسائر', 'owner', undefined);

    expect(reports.getGeneralProfitLoss).toHaveBeenCalled();
    expect(dashboard.buildDashboardInsights).not.toHaveBeenCalled();
    expect(res.meta?.intent).toBe('reports');
    expect(res.answerAr).toMatch(/ملخص الربح والخسارة/);
  });

  it('routes نسبة المشتريات من المبيعات to finance ratios when Gemini returns finance_ratios', async () => {
    const { chat, dashboard } = mkDeps({
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
  });

  it('keyword fallback still handles month status when Gemini is unavailable', async () => {
    const { chat, dashboard, gemini } = mkDeps({
      isAvailable: () => false,
      parseIntent: jest.fn(),
    });

    const res = await chat.processQuery(companyId, 'كيف وضع الشهر؟', 'owner', undefined);

    expect(gemini.parseIntent).not.toHaveBeenCalled();
    expect(dashboard.buildDashboardInsights).toHaveBeenCalled();
    expect(res.meta?.intentSource).toBe('keyword');
  });

  it('does not call dashboard insights when Gemini returns reports for profit and loss report', async () => {
    const { chat, dashboard } = mkDeps({
      parseIntent: jest.fn().mockResolvedValue({ intent: 'reports', period: null, rawQuery: 'x' }),
    });
    await chat.processQuery(companyId, 'profit and loss report', 'owner', undefined);
    expect(dashboard.buildDashboardInsights).not.toHaveBeenCalled();
  });
});
