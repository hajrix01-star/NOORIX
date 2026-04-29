import { PERMISSIONS } from '../../auth/constants/permissions';
import { INSIGHTS_SCHEMA_VERSION } from '../../reporting/insights/insights.types';
import type { DashboardInsightsPayload } from '../../reporting/insights/insights.types';
import {
  dashboardInsightsHandler,
  buildDashboardInsightsDateRangeForMonth,
} from './dashboard-insights.handler';
import { financeRatiosHandler } from './finance-ratios.handler';
import type { ChatHandlerContext } from './types';
import { normalizeQuery, parsePeriod } from './utils';

function mkPayload(
  overrides: Partial<DashboardInsightsPayload> & { warnings?: DashboardInsightsPayload['warnings'] },
): DashboardInsightsPayload {
  const defaults: DashboardInsightsPayload = {
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
      accounting: {
        sales: null,
        purchases: null,
        expenses: null,
        grossProfit: null,
        netProfit: null,
      },
      operational: {},
    },
    ratios: {
      purchaseToSales: null,
      expenseToSales: null,
      netProfitMargin: null,
      notes: [],
    },
    health: {
      score: 50,
      band: 'amber',
      summaryAr: 'يوجد تحذيرات تستحق المراجعة.',
      summaryEn: 'There are warnings to review.',
    },
    insights: [],
    opportunities: [],
    warnings: [],
  };
  return { ...defaults, ...overrides };
}

function mkCtx(
  partial: Partial<Omit<ChatHandlerContext, 'dashboardInsightsService'>> & {
    dashboardInsightsService?: { buildDashboardInsights: jest.Mock };
  },
): ChatHandlerContext {
  const buildDashboardInsights = partial.dashboardInsightsService?.buildDashboardInsights ?? jest.fn();
  const base = {
    companyId: 'c1',
    query: '',
    userRole: 'owner',
    now: new Date('2024-03-15T12:00:00.000Z'),
    year: 2024,
    month: 3,
    period: null as ChatHandlerContext['period'],
    can: (p: string) =>
      [PERMISSIONS.SMART_CHAT_READ, PERMISSIONS.REPORTS_READ].includes(p as any),
    prisma: {},
    reportsService: {},
    vaultsService: {},
    dashboardInsightsService: { buildDashboardInsights } as unknown as ChatHandlerContext['dashboardInsightsService'],
    ...partial,
  };
  if (partial.dashboardInsightsService) {
    base.dashboardInsightsService = partial.dashboardInsightsService as unknown as ChatHandlerContext['dashboardInsightsService'];
  }
  return base as ChatHandlerContext;
}

describe('dashboardInsightsHandler', () => {
  const refDate = new Date('2024-03-15T12:00:00.000Z');

  it('returns health summary and warning bullets for كيف وضع الشهر؟', async () => {
    const rawQ = 'كيف وضع الشهر؟';
    const q = normalizeQuery(rawQ);
    const period = parsePeriod(q, refDate);
    const payload = mkPayload({
      warnings: [
        {
          id: 'expense_ratio_to_sales',
          severity: 'warning',
          category: 'expenses',
          metricBasis: 'accounting_pl',
          titleAr: 'تنبيه مصروفات',
          titleEn: 'Expense alert',
          detailAr: 'تفاصيل من الخادم.',
          detailEn: 'Server detail.',
        },
        {
          id: 'purchase_ratio_to_sales',
          severity: 'warning',
          category: 'purchases',
          metricBasis: 'accounting_pl',
          titleAr: 'مشتريات',
          titleEn: 'Purchases',
          detailAr: 'نسبة.',
          detailEn: 'Ratio.',
        },
      ],
    });
    const buildDashboardInsights = jest.fn().mockResolvedValue(payload);
    const ctx = mkCtx({ query: q, period, dashboardInsightsService: { buildDashboardInsights } });

    const out = await dashboardInsightsHandler.process!(ctx);
    expect(out?.answerAr).toContain('يوجد تحذيرات تستحق المراجعة.');
    expect(out?.answerAr).toContain('تنبيه مصروفات');
    expect(out?.answerAr).toContain('مشتريات');
    expect(buildDashboardInsights).toHaveBeenCalledTimes(1);
    expect(buildDashboardInsights).toHaveBeenCalledWith(
      'c1',
      buildDashboardInsightsDateRangeForMonth(2024, 3),
      3,
      refDate,
    );
  });

  it('هل المشتريات مرتفعة؟ returns only purchase-related insights', async () => {
    const q = normalizeQuery('هل المشتريات مرتفعة؟');
    const payload = mkPayload({
      warnings: [
        {
          id: 'expense_ratio_to_sales',
          severity: 'warning',
          category: 'expenses',
          metricBasis: 'accounting_pl',
          titleAr: 'مصروفات فقط',
          titleEn: 'Expenses only',
          detailAr: 'x',
          detailEn: 'x',
        },
        {
          id: 'purchase_ratio_to_sales',
          severity: 'warning',
          category: 'purchases',
          metricBasis: 'accounting_pl',
          titleAr: 'مشتريات من المبيعات',
          titleEn: 'Purchases vs sales',
          detailAr: 'من الخادم.',
          detailEn: 'From server.',
        },
      ],
    });
    const buildDashboardInsights = jest.fn().mockResolvedValue(payload);
    const ctx = mkCtx({
      query: q,
      period: null,
      now: refDate,
      dashboardInsightsService: { buildDashboardInsights },
    });

    const out = await dashboardInsightsHandler.process!(ctx);
    expect(out?.answerAr).toContain('مشتريات من المبيعات');
    expect(out?.answerAr).not.toContain('مصروفات فقط');
  });

  it('هل الربح جيد؟ returns only profit-related insights', async () => {
    const q = normalizeQuery('هل الربح جيد؟');
    const payload = mkPayload({
      warnings: [
        {
          id: 'purchase_ratio_to_sales',
          severity: 'warning',
          category: 'purchases',
          metricBasis: 'accounting_pl',
          titleAr: 'مشتريات',
          titleEn: 'Purchases',
          detailAr: 'x',
          detailEn: 'x',
        },
        {
          id: 'net_profit_margin',
          severity: 'warning',
          category: 'profit',
          metricBasis: 'accounting_pl',
          titleAr: 'هامش ربح',
          titleEn: 'Margin',
          detailAr: 'من الخادم.',
          detailEn: 'From server.',
        },
      ],
    });
    const buildDashboardInsights = jest.fn().mockResolvedValue(payload);
    const ctx = mkCtx({ query: q, period: null, dashboardInsightsService: { buildDashboardInsights } });

    const out = await dashboardInsightsHandler.process!(ctx);
    expect(out?.answerAr).toContain('هامش ربح');
    expect(out?.answerAr).not.toContain('مشتريات');
  });

  it('uses neutral message when there are no warnings', async () => {
    const q = normalizeQuery('ملخص الشهر');
    const payload = mkPayload({ warnings: [] });
    const buildDashboardInsights = jest.fn().mockResolvedValue(payload);
    const ctx = mkCtx({ query: q, period: null, dashboardInsightsService: { buildDashboardInsights } });

    const out = await dashboardInsightsHandler.process!(ctx);
    expect(out?.answerAr).toContain('لا توجد تنبيهات مالية واضحة حالياً حسب حدود التحليل الحالية.');
    expect(out?.answerEn).toContain('No clear financial alerts based on the current insight thresholds.');
  });

  it('blocks when user lacks REPORTS_READ', async () => {
    const q = normalizeQuery('ملخص الشهر');
    const buildDashboardInsights = jest.fn();
    const ctx = mkCtx({
      query: q,
      can: (p: string) => p === PERMISSIONS.SMART_CHAT_READ,
      dashboardInsightsService: { buildDashboardInsights },
    });

    const out = await dashboardInsightsHandler.process!(ctx);
    expect(out?.answerAr).toContain('عرض التقارير');
    expect(buildDashboardInsights).not.toHaveBeenCalled();
  });

  it('finance_ratios handler still matches its ratio bundle phrases', () => {
    const canSales = () => true;
    expect(
      financeRatiosHandler.canHandle(normalizeQuery('نسب الخارج على المبيعات'), canSales),
    ).toBe(true);
  });

  it('does not invoke prisma or reportsService — only dashboardInsightsService', async () => {
    const q = normalizeQuery('how is the month');
    const prismaSpy = jest.fn();
    const buildDashboardInsights = jest.fn().mockResolvedValue(mkPayload({ warnings: [] }));
    const ctx = mkCtx({
      query: q,
      prisma: { ledgerEntry: { aggregate: prismaSpy } },
      reportsService: { getGeneralProfitLoss: jest.fn() },
      dashboardInsightsService: { buildDashboardInsights },
    });

    await dashboardInsightsHandler.process!(ctx);
    expect(buildDashboardInsights).toHaveBeenCalled();
    expect(prismaSpy).not.toHaveBeenCalled();
  });
});
