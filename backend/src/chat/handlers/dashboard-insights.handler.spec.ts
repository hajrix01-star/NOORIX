import { PERMISSIONS } from '../../auth/constants/permissions';
import { INSIGHTS_SCHEMA_VERSION } from '../../reporting/insights/insights.types';
import type { DashboardInsightsPayload } from '../../reporting/insights/insights.types';
import {
  dashboardInsightsHandler,
  buildDashboardInsightsDateRangeForMonth,
  buildInsightsExplanationPackage,
  formatInsightsPeriodLabelAr,
  formatInsightsPeriodLabelEn,
  parseDashboardInsightsMonth,
  resolveInsightsYearMonth,
  validateInsightsLlmAnswer,
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

  it('uses business-friendly no-alert copy when there are no warnings, with period line', async () => {
    const q = normalizeQuery('ملخص الشهر');
    const payload = mkPayload({ warnings: [] });
    const buildDashboardInsights = jest.fn().mockResolvedValue(payload);
    const ctx = mkCtx({ query: q, period: null, dashboardInsightsService: { buildDashboardInsights } });

    const out = await dashboardInsightsHandler.process!(ctx);
    expect(out?.answerAr).not.toMatch(/الإصدار|قواعد/i);
    expect(out?.answerAr).toContain('لا توجد تنبيهات مالية حالياً.');
    expect(out?.answerAr).toContain('الأرقام الحالية لا تتجاوز حدود التحذير المحددة لهذه الشركة.');
    expect(out?.answerAr).toContain(formatInsightsPeriodLabelAr(2024, 3));
    expect(out?.answerEn).toContain('No financial alerts right now.');
    expect(out?.answerEn).toContain("Current figures do not exceed this company's configured warning thresholds.");
    expect(out?.answerEn).toContain(formatInsightsPeriodLabelEn(2024, 3));
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

  it('كيف وضع أبريل 2026؟ resolves to April 2026 for buildDashboardInsights', async () => {
    const q = normalizeQuery('كيف وضع أبريل 2026؟');
    const buildDashboardInsights = jest.fn().mockResolvedValue(mkPayload({ warnings: [] }));
    const ctx = mkCtx({
      query: q,
      period: parsePeriod(q, refDate),
      now: refDate,
      dashboardInsightsService: { buildDashboardInsights },
    });

    await dashboardInsightsHandler.process!(ctx);
    expect(buildDashboardInsights).toHaveBeenCalledWith(
      'c1',
      buildDashboardInsightsDateRangeForMonth(2026, 4),
      4,
      refDate,
    );
  });

  it('هل المشتريات مرتفعة في ابريل 2026؟ resolves to 4/2026', async () => {
    const q = normalizeQuery('هل المشتريات مرتفعة في ابريل 2026؟');
    const buildDashboardInsights = jest.fn().mockResolvedValue(mkPayload({ warnings: [] }));
    const ctx = mkCtx({ query: q, now: refDate, dashboardInsightsService: { buildDashboardInsights } });

    await dashboardInsightsHandler.process!(ctx);
    expect(buildDashboardInsights).toHaveBeenCalledWith(
      'c1',
      buildDashboardInsightsDateRangeForMonth(2026, 4),
      4,
      refDate,
    );
  });

  it('How is April 2026? resolves to 4/2026 and period labels in response', async () => {
    const q = normalizeQuery('How is April 2026?');
    const buildDashboardInsights = jest.fn().mockResolvedValue(mkPayload({ warnings: [] }));
    const ctx = mkCtx({ query: q, now: refDate, dashboardInsightsService: { buildDashboardInsights } });

    const out = await dashboardInsightsHandler.process!(ctx);
    expect(buildDashboardInsights).toHaveBeenCalledWith(
      'c1',
      buildDashboardInsightsDateRangeForMonth(2026, 4),
      4,
      refDate,
    );
    expect(out?.answerAr).toContain(formatInsightsPeriodLabelAr(2026, 4));
    expect(out?.answerEn).toContain(formatInsightsPeriodLabelEn(2026, 4));
  });

  it('كيف وضع يناير؟ without year uses now.getFullYear()', async () => {
    const q = normalizeQuery('كيف وضع يناير؟');
    const buildDashboardInsights = jest.fn().mockResolvedValue(mkPayload({ warnings: [] }));
    const ctx = mkCtx({ query: q, now: refDate, dashboardInsightsService: { buildDashboardInsights } });

    await dashboardInsightsHandler.process!(ctx);
    expect(buildDashboardInsights).toHaveBeenCalledWith(
      'c1',
      buildDashboardInsightsDateRangeForMonth(2024, 1),
      1,
      refDate,
    );
  });

  it('query with both الشهر and أبريل 2026 uses April 2026, not current month from parsePeriod', async () => {
    const raw = 'كيف وضع الشهر في أبريل 2026؟';
    const q = normalizeQuery(raw);
    const period = parsePeriod(q, refDate);
    expect(period).not.toBeNull();
    const buildDashboardInsights = jest.fn().mockResolvedValue(mkPayload({ warnings: [] }));
    const ctx = mkCtx({
      query: q,
      period,
      now: refDate,
      dashboardInsightsService: { buildDashboardInsights },
    });

    await dashboardInsightsHandler.process!(ctx);
    expect(buildDashboardInsights).toHaveBeenCalledWith(
      'c1',
      buildDashboardInsightsDateRangeForMonth(2026, 4),
      4,
      refDate,
    );
  });

  it('كيف وضع الشهر الماضي؟ still uses ctx.period from parsePeriod', async () => {
    const q = normalizeQuery('كيف وضع الشهر الماضي؟');
    const period = parsePeriod(q, refDate);
    expect(period).not.toBeNull();
    const buildDashboardInsights = jest.fn().mockResolvedValue(mkPayload({ warnings: [] }));
    const ctx = mkCtx({ query: q, period, now: refDate, dashboardInsightsService: { buildDashboardInsights } });

    await dashboardInsightsHandler.process!(ctx);
    expect(parseDashboardInsightsMonth(q, refDate)).toBeNull();
    expect(buildDashboardInsights).toHaveBeenCalledWith(
      'c1',
      buildDashboardInsightsDateRangeForMonth(2024, 2),
      2,
      refDate,
    );
  });

  it('Gemini-routed dashboard_insights uses general kind when classify returns null', async () => {
    const q = normalizeQuery('random paraphrase only');
    const buildDashboardInsights = jest.fn().mockResolvedValue(mkPayload({ warnings: [] }));
    const ctx = mkCtx({
      query: q,
      intentSource: 'gemini',
      parsedIntent: 'dashboard_insights',
      now: refDate,
      dashboardInsightsService: { buildDashboardInsights },
    });
    const out = await dashboardInsightsHandler.process!(ctx);
    expect(buildDashboardInsights).toHaveBeenCalled();
    expect(out?.answerAr).toContain('لا توجد تنبيهات مالية حالياً.');
  });

  it('buildInsightsExplanationPackage contains only safe JSON fields (no DB rows)', () => {
    const payload = mkPayload({ warnings: [] });
    const pack = buildInsightsExplanationPackage(payload, 'general', 2024, 3);
    expect(Object.keys(pack).sort()).toEqual(
      ['health', 'insights', 'metrics', 'periodLabel', 'ratios', 'warnings'].sort(),
    );
    expect(pack).not.toHaveProperty('ledger');
    expect(pack).not.toHaveProperty('prisma');
  });

  it('validateInsightsLlmAnswer rejects invented large numbers not present in pack JSON', () => {
    const pack = JSON.stringify({ health: { score: 50 }, warnings: [] });
    expect(
      validateInsightsLlmAnswer(
        {
          answerAr: 'ملخص طويل بما يكفي لاجتياز الحد الأدنى للطول مع رقم وهمي 987654',
          answerEn: 'English summary long enough with fake number 987654',
        },
        pack,
      ),
    ).toBe(false);
  });

  it('validateInsightsLlmAnswer accepts LLM text when large numbers appear in the pack', () => {
    const pack = JSON.stringify({ ratios: { note: 'sales 12000 SR' } });
    expect(
      validateInsightsLlmAnswer(
        {
          answerAr: 'الوضع مستقر نسبياً وفق البيانات. المبيعات 12000 SR ضمن النطاق.',
          answerEn: 'Status is stable per data. Sales 12000 SR within range.',
        },
        pack.replace(/\s+/g, ''),
      ),
    ).toBe(true);
  });

  it('falls back to deterministic answer when insightsLlmExplain returns null', async () => {
    const q = normalizeQuery('كيف وضع الشهر؟');
    const payload = mkPayload({
      warnings: [
        {
          id: 'purchase_ratio_to_sales',
          severity: 'warning',
          category: 'purchases',
          metricBasis: 'accounting_pl',
          titleAr: 'عنوان',
          titleEn: 'Title',
          detailAr: 'تفاصيل.',
          detailEn: 'Details.',
        },
      ],
    });
    const buildDashboardInsights = jest.fn().mockResolvedValue(payload);
    const insightsLlmExplain = jest.fn().mockResolvedValue(null);
    const ctx = mkCtx({
      query: q,
      period: parsePeriod(q, refDate),
      now: refDate,
      dashboardInsightsService: { buildDashboardInsights },
      insightsLlmExplain,
    });
    const out = await dashboardInsightsHandler.process!(ctx);
    expect(insightsLlmExplain).toHaveBeenCalled();
    expect(out?.answerAr).toContain('عنوان');
  });

  it('uses LLM text when insightsLlmExplain returns a grounded valid response', async () => {
    const q = normalizeQuery('how is the month');
    const payload = mkPayload({
      warnings: [
        {
          id: 'purchase_ratio_to_sales',
          severity: 'warning',
          category: 'purchases',
          metricBasis: 'accounting_pl',
          titleAr: 'مشتريات',
          titleEn: 'Purchases',
          detailAr: 'من الخادم.',
          detailEn: 'From server.',
        },
      ],
    });
    const buildDashboardInsights = jest.fn().mockResolvedValue(payload);
    const packForAssert = buildInsightsExplanationPackage(payload, 'general', 2024, 3);
    const insightsLlmExplain = jest.fn().mockImplementation((_query, pack) => {
      expect(pack).toEqual(packForAssert);
      return Promise.resolve({
        answerAr: 'الوضع يحتاج متابعة وفق التنبيهات المعروضة في البيانات فقط.',
        answerEn: 'The situation needs follow-up per the warnings shown in the data only.',
      });
    });
    const ctx = mkCtx({
      query: q,
      now: refDate,
      dashboardInsightsService: { buildDashboardInsights },
      insightsLlmExplain,
    });
    const out = await dashboardInsightsHandler.process!(ctx);
    expect(out?.answerEn).toContain('follow-up per the warnings');
    expect(out?.answerAr).toContain('التنبيهات');
  });
});

describe('parseDashboardInsightsMonth / resolveInsightsYearMonth', () => {
  const refDate = new Date('2024-03-15T12:00:00.000Z');

  it('parse: Arabic month + year', () => {
    expect(parseDashboardInsightsMonth(normalizeQuery('كيف وضع أبريل 2026؟'), refDate)).toEqual({
      year: 2026,
      selectedMonth: 4,
    });
  });

  it('resolveInsightsYearMonth prefers explicit month over ctx.period', () => {
    const q = normalizeQuery('كيف وضع الشهر في أبريل 2026؟');
    const period = parsePeriod(q, refDate)!;
    const ctx = mkCtx({ query: q, period, now: refDate });
    expect(resolveInsightsYearMonth(ctx)).toEqual({ year: 2026, selectedMonth: 4 });
  });
});
