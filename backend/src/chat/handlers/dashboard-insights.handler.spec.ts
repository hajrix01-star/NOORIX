import { PERMISSIONS } from '../../auth/constants/permissions';
import { INSIGHTS_SCHEMA_VERSION } from '../../reporting/insights/insights.types';
import type { DashboardInsightsPayload } from '../../reporting/insights/insights.types';
import { EXTENDED_REPORTING_INSIGHTS_SCHEMA_VERSION } from '../../reporting/insights/reporting-insights-aggregator.types';
import type {
  CombinedInsightWarning,
  ExtendedReportingInsightsPayload,
} from '../../reporting/insights/reporting-insights-aggregator.types';
import {
  dashboardInsightsHandler,
  buildDashboardInsightsDateRangeForMonth,
  buildExtendedInsightsExplanationPackage,
  buildInsightsExplanationPackage,
  classifyDashboardInsightsQuery,
  formatInsightsPeriodLabelAr,
  formatInsightsPeriodLabelEn,
  parseDashboardInsightsMonth,
  resolveDashboardInsightsFocus,
  resolveEffectiveDashboardInsightsFocus,
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

function mkExtendedFromDashboard(
  dash: DashboardInsightsPayload,
  dateRange = buildDashboardInsightsDateRangeForMonth(dash.context.year, dash.context.selectedMonth ?? 3),
): ExtendedReportingInsightsPayload {
  const { companyId, year, selectedMonth } = dash.context;
  const sm = selectedMonth ?? null;
  return {
    schemaVersion: EXTENDED_REPORTING_INSIGHTS_SCHEMA_VERSION,
    generatedAt: dash.generatedAt,
    context: {
      companyId,
      year,
      selectedMonth: sm,
      periodStart: dateRange.periodStart,
      periodEnd: dateRange.periodEnd,
      labels: {
        dashboard: 'dashboard_insights_v1',
        purchases: 'purchase_supplier_insights_v1',
        expenses: 'expense_insights_v1',
      },
    },
    dashboardInsights: dash,
    purchaseSupplierInsights: {
      schemaVersion: 1,
      generatedAt: '',
      context: {
        companyId,
        year,
        selectedMonth: sm,
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

/** Full extended payload with explicit merged warnings (as after aggregator dedupe/sort). */
function mkExtendedWithMergedWarnings(
  merged: CombinedInsightWarning[],
  dashOverrides?: Partial<DashboardInsightsPayload>,
): ExtendedReportingInsightsPayload {
  const dash = mkPayload({ ...dashOverrides, warnings: [] });
  const year = dash.context.year;
  const sm = dash.context.selectedMonth ?? 3;
  const dateRange = buildDashboardInsightsDateRangeForMonth(year, sm);
  const purchaseWarnings: DashboardInsightsPayload['warnings'] = merged
    .filter((w) => w.source === 'purchases')
    .map(({ source: _s, ...w }) => w);
  const expenseWarnings: DashboardInsightsPayload['warnings'] = merged
    .filter((w) => w.source === 'expenses')
    .map(({ source: _s, ...w }) => w);
  return {
    schemaVersion: EXTENDED_REPORTING_INSIGHTS_SCHEMA_VERSION,
    generatedAt: '2024-03-15T12:00:00.000Z',
    context: {
      companyId: dash.context.companyId,
      year,
      selectedMonth: sm,
      periodStart: dateRange.periodStart,
      periodEnd: dateRange.periodEnd,
      labels: {
        dashboard: 'dashboard_insights_v1',
        purchases: 'purchase_supplier_insights_v1',
        expenses: 'expense_insights_v1',
      },
    },
    dashboardInsights: dash,
    purchaseSupplierInsights: {
      schemaVersion: 1,
      generatedAt: '',
      context: {
        companyId: dash.context.companyId,
        year,
        selectedMonth: sm,
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
      warnings: purchaseWarnings,
    },
    expenseInsights: {
      schemaVersion: 1,
      generatedAt: '',
      context: {
        companyId: dash.context.companyId,
        year,
        selectedMonth: sm,
        labels: {
          expenseBreakdownScope: 'accounting_ledger_pl_month',
          expenseSpikeScope: 'accounting_ledger_pl_expense_totals',
          fixedExpenseScope: 'accounting_ledger_pl_kind_fixed_expense',
        },
      },
      expenseInsights: [],
      warnings: expenseWarnings,
    },
    warnings: merged,
  };
}

const RAW_PAYLOAD_KEYS = [
  'schemaVersion',
  'generatedAt',
  'dashboardInsights',
  'purchaseSupplierInsights',
  'expenseInsights',
] as const;

function mkCtx(
  partial: Partial<Omit<ChatHandlerContext, 'dashboardInsightsService' | 'reportingInsightsAggregatorService'>> & {
    dashboardInsightsService?: { buildDashboardInsights: jest.Mock };
    reportingInsightsAggregatorService?: { getExtendedInsights: jest.Mock };
  },
): ChatHandlerContext {
  const buildDashboardInsights = partial.dashboardInsightsService?.buildDashboardInsights ?? jest.fn();
  const getExtendedInsights =
    partial.reportingInsightsAggregatorService?.getExtendedInsights ??
    jest.fn().mockImplementation(async (companyId: string, dateRange: unknown, selectedMonth: number, refDate: Date) => {
      const dash = await buildDashboardInsights(companyId, dateRange, selectedMonth, refDate);
      return mkExtendedFromDashboard(dash, dateRange as ReturnType<typeof buildDashboardInsightsDateRangeForMonth>);
    });
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
    reportingInsightsAggregatorService: { getExtendedInsights } as unknown as ChatHandlerContext['reportingInsightsAggregatorService'],
    ...partial,
  };
  if (partial.dashboardInsightsService) {
    base.dashboardInsightsService = partial.dashboardInsightsService as unknown as ChatHandlerContext['dashboardInsightsService'];
  }
  if (partial.reportingInsightsAggregatorService) {
    base.reportingInsightsAggregatorService =
      partial.reportingInsightsAggregatorService as unknown as ChatHandlerContext['reportingInsightsAggregatorService'];
  }
  return base as ChatHandlerContext;
}

describe('dashboardInsightsHandler', () => {
  const refDate = new Date('2024-03-15T12:00:00.000Z');

  it('classifyDashboardInsightsQuery matches حلل المشتريات (purchase analysis phrase)', () => {
    expect(classifyDashboardInsightsQuery(normalizeQuery('حلل المشتريات'))).toBe('general');
  });

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
    expect(ctx.reportingInsightsAggregatorService.getExtendedInsights).toHaveBeenCalledTimes(1);
    expect(ctx.reportingInsightsAggregatorService.getExtendedInsights).toHaveBeenCalledWith(
      'c1',
      buildDashboardInsightsDateRangeForMonth(2024, 3),
      3,
      refDate,
    );
    expect(buildDashboardInsights).toHaveBeenCalledTimes(1);
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
    expect(ctx.reportingInsightsAggregatorService.getExtendedInsights).not.toHaveBeenCalled();
  });

  it('finance_ratios handler still matches its ratio bundle phrases', () => {
    const canSales = () => true;
    expect(
      financeRatiosHandler.canHandle(normalizeQuery('نسب الخارج على المبيعات'), canSales),
    ).toBe(true);
  });

  it('does not invoke prisma or reportsService — uses ReportingInsightsAggregatorService', async () => {
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
    expect(ctx.reportingInsightsAggregatorService.getExtendedInsights).toHaveBeenCalled();
    expect(buildDashboardInsights).toHaveBeenCalled();
    expect(prismaSpy).not.toHaveBeenCalled();
  });

  it('كيف وضع أبريل 2026؟ resolves to April 2026 for getExtendedInsights', async () => {
    const q = normalizeQuery('كيف وضع أبريل 2026؟');
    const buildDashboardInsights = jest.fn().mockResolvedValue(mkPayload({ warnings: [] }));
    const ctx = mkCtx({
      query: q,
      period: parsePeriod(q, refDate),
      now: refDate,
      dashboardInsightsService: { buildDashboardInsights },
    });

    await dashboardInsightsHandler.process!(ctx);
    expect(ctx.reportingInsightsAggregatorService.getExtendedInsights).toHaveBeenCalledWith(
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
    expect(ctx.reportingInsightsAggregatorService.getExtendedInsights).toHaveBeenCalledWith(
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
    expect(ctx.reportingInsightsAggregatorService.getExtendedInsights).toHaveBeenCalledWith(
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
    expect(ctx.reportingInsightsAggregatorService.getExtendedInsights).toHaveBeenCalledWith(
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
    expect(ctx.reportingInsightsAggregatorService.getExtendedInsights).toHaveBeenCalledWith(
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
    expect(ctx.reportingInsightsAggregatorService.getExtendedInsights).toHaveBeenCalledWith(
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
    expect(ctx.reportingInsightsAggregatorService.getExtendedInsights).toHaveBeenCalled();
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

  it('buildExtendedInsightsExplanationPackage adds merged overview fields for LLM', () => {
    const dash = mkPayload({ warnings: [] });
    const ext = mkExtendedFromDashboard(dash);
    const pack = buildExtendedInsightsExplanationPackage(ext, 'overview', 2024, 3);
    expect(pack).toHaveProperty('mergedOverview');
    expect(pack).toHaveProperty('purchaseSupplierWarningCount');
    expect(pack).toHaveProperty('expenseWarningCount');
    expect(Object.keys(pack).sort()).toContain('warnings');
    expect((pack as { mergedOverview?: { focus?: string } }).mergedOverview?.focus).toBe('overview');
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
    const extended = mkExtendedFromDashboard(payload);
    const packForAssert = buildExtendedInsightsExplanationPackage(extended, 'overview', 2024, 3);
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

describe('dashboard_insights response quality (mocked extended payload)', () => {
  const refDate = new Date('2024-03-15T12:00:00.000Z');

  function mixedSeverityMerged(): CombinedInsightWarning[] {
    return [
      {
        id: 'negative_profit_warning',
        severity: 'critical',
        category: 'profit',
        metricBasis: 'accounting_pl',
        titleAr: 'تحذير حرج للربح',
        titleEn: 'Critical profit alert',
        detailAr: 'تفاصيل حرجة.',
        detailEn: 'Critical details.',
        source: 'dashboard',
      },
      {
        id: 'supplier_concentration_high',
        severity: 'warning',
        category: 'purchases',
        metricBasis: 'invoice_period',
        titleAr: 'تنبيه موردين',
        titleEn: 'Supplier concentration',
        detailAr: 'من المشتريات.',
        detailEn: 'From purchases.',
        source: 'purchases',
      },
      {
        id: 'expense_spike_operational',
        severity: 'warning',
        category: 'expenses',
        metricBasis: 'accounting_pl',
        titleAr: 'قفزة مصروفات',
        titleEn: 'Expense spike',
        detailAr: 'من المصاريف.',
        detailEn: 'From expenses.',
        source: 'expenses',
      },
      {
        id: 'info_sales_note',
        severity: 'info',
        category: 'sales',
        metricBasis: 'operational_sales',
        titleAr: 'معلومة مبيعات',
        titleEn: 'Sales info note',
        detailAr: 'للمتابعة.',
        detailEn: 'For awareness.',
        source: 'dashboard',
      },
    ];
  }

  it('deterministic general answer: no raw JSON keys; compact severity counts; critical highlighted; Arabic sources', async () => {
    const q = normalizeQuery('كيف وضع الشهر؟');
    const extended = mkExtendedWithMergedWarnings(mixedSeverityMerged(), {
      health: {
        score: 40,
        band: 'red',
        summaryAr: 'ملخص صحة مختصر.',
        summaryEn: 'Short health summary.',
      },
    });
    const ctx = mkCtx({
      query: q,
      period: parsePeriod(q, refDate),
      now: refDate,
      reportingInsightsAggregatorService: {
        getExtendedInsights: jest.fn().mockResolvedValue(extended),
      },
      insightsLlmExplain: undefined,
    });
    const out = await dashboardInsightsHandler.process!(ctx);
    const combined = `${out?.answerAr}\n${out?.answerEn}`;
    for (const key of RAW_PAYLOAD_KEYS) {
      expect(combined).not.toContain(key);
    }
    expect(out?.answerAr).toContain('ملخص التنبيهات: 4 إجمالي');
    expect(out?.answerAr).toContain('1 حرج');
    expect(out?.answerAr).toContain('2 تحذير');
    expect(out?.answerAr).toContain('1 معلومات');
    expect(out?.answerAr).toContain('المصادر: لوحة، مشتريات، مصاريف');
    expect(out?.answerAr).toContain('أبرز التنبيهات: تحذير حرج للربح');
    expect(out?.answerAr).toContain('[لوحة]');
    expect(out?.answerAr).toContain('[مشتريات]');
    expect(out?.answerAr).toContain('[مصاريف]');
    expect(out?.answerAr).not.toContain('InsightWarningSource');
    expect(out?.answerAr).not.toContain('purchase_supplier_insights_v1');
    const bulletCount = (out?.answerAr.match(/•/g) || []).length;
    expect(bulletCount).toBe(3);
    expect(out?.answerAr).not.toContain('• [لوحة] معلومة مبيعات');
    expect(out?.answerEn).toContain('Alert overview: 4 total');
    expect(out?.answerEn).toContain('1 critical');
    expect(out?.answerEn).toContain('Top alerts: Critical profit alert');
  });

  it('does not repeat bullet lines for aggregator-deduped merged warnings', async () => {
    const merged: CombinedInsightWarning[] = [
      {
        id: 'purchase_ratio_to_sales',
        severity: 'warning',
        category: 'purchases',
        metricBasis: 'accounting_pl',
        titleAr: 'عنوان فريد ألف',
        titleEn: 'Unique title alpha',
        detailAr: 'واحد',
        detailEn: 'one',
        source: 'dashboard',
      },
      {
        id: 'expense_ratio_to_sales',
        severity: 'warning',
        category: 'expenses',
        metricBasis: 'accounting_pl',
        titleAr: 'عنوان فريد باء',
        titleEn: 'Unique title beta',
        detailAr: 'اثنان',
        detailEn: 'two',
        source: 'expenses',
      },
      {
        id: 'supplier_concentration_high',
        severity: 'info',
        category: 'purchases',
        metricBasis: 'invoice_period',
        titleAr: 'عنوان فريد جيم',
        titleEn: 'Unique title gamma',
        detailAr: 'ثلاثة',
        detailEn: 'three',
        source: 'purchases',
      },
    ];
    const q = normalizeQuery('كيف وضع الشهر؟');
    const ctx = mkCtx({
      query: q,
      period: parsePeriod(q, refDate),
      now: refDate,
      reportingInsightsAggregatorService: {
        getExtendedInsights: jest.fn().mockResolvedValue(mkExtendedWithMergedWarnings(merged)),
      },
    });
    const out = await dashboardInsightsHandler.process!(ctx);
    expect((out?.answerAr.match(/عنوان فريد ألف/g) || []).length).toBe(1);
    expect((out?.answerAr.match(/عنوان فريد باء/g) || []).length).toBe(1);
    expect((out?.answerAr.match(/عنوان فريد جيم/g) || []).length).toBe(1);
    expect((out?.answerAr.match(/•/g) || []).length).toBe(3);
  });

  it('empty merged warnings: useful period + no-alert copy; no bullets; no alert overview line', async () => {
    const q = normalizeQuery('ملخص الشهر');
    const extended = mkExtendedWithMergedWarnings([], {
      health: {
        score: 72,
        band: 'green',
        summaryAr: 'الوضع مطمئن من ناحية الصحة.',
        summaryEn: 'Health looks reassuring.',
      },
    });
    const ctx = mkCtx({
      query: q,
      period: null,
      now: refDate,
      reportingInsightsAggregatorService: {
        getExtendedInsights: jest.fn().mockResolvedValue(extended),
      },
    });
    const out = await dashboardInsightsHandler.process!(ctx);
    expect(out?.answerAr).toContain(formatInsightsPeriodLabelAr(2024, 3));
    expect(out?.answerAr).toContain('لا توجد تنبيهات مالية حالياً.');
    expect(out?.answerAr).not.toContain('•');
    expect(out?.answerAr).not.toContain('ملخص التنبيهات');
    expect(out?.answerAr).not.toContain('أبرز التنبيهات');
    expect(out?.answerAr).not.toMatch(/حرج|critical/i);
    expect(out?.answerEn).not.toContain('•');
    expect(out?.answerEn).not.toContain('Alert overview');
  });

  it('insightsLlmExplain receives extended grounding object without nested payload roots (returns null → deterministic)', async () => {
    const q = normalizeQuery('كيف وضع الشهر؟');
    const extended = mkExtendedWithMergedWarnings(mixedSeverityMerged());
    let captured: Record<string, unknown> | undefined;
    const insightsLlmExplain = jest.fn().mockImplementation((_query, pack: Record<string, unknown>) => {
      captured = pack;
      return Promise.resolve(null);
    });
    const ctx = mkCtx({
      query: q,
      period: parsePeriod(q, refDate),
      now: refDate,
      reportingInsightsAggregatorService: {
        getExtendedInsights: jest.fn().mockResolvedValue(extended),
      },
      insightsLlmExplain,
    });
    const out = await dashboardInsightsHandler.process!(ctx);
    expect(insightsLlmExplain).toHaveBeenCalled();
    expect(captured).toBeDefined();
    for (const key of RAW_PAYLOAD_KEYS) {
      expect(captured!).not.toHaveProperty(key);
    }
    expect(captured!.mergedOverview).toEqual(
      expect.objectContaining({
        total: 4,
        critical: 1,
        warning: 2,
        info: 1,
        sourcesPresent: expect.arrayContaining(['dashboard', 'purchases', 'expenses']),
        focus: 'overview',
      }),
    );
    const w = captured!.warnings as Array<{ source?: string }>;
    expect(w.length).toBeGreaterThan(0);
    expect(w.every((row) => row.source === 'dashboard' || row.source === 'purchases' || row.source === 'expenses')).toBe(
      true,
    );
    const userFacing = `${out?.answerAr}\n${out?.answerEn}`;
    for (const key of RAW_PAYLOAD_KEYS) {
      expect(userFacing).not.toContain(key);
    }
  });
});

describe('resolveDashboardInsightsFocus / focused Smart Chat answers', () => {
  const refDate = new Date('2024-03-15T12:00:00.000Z');

  it('resolveDashboardInsightsFocus detects Arabic purchases, expenses, profitability, alerts, overview', () => {
    expect(resolveDashboardInsightsFocus(normalizeQuery('حلل المشتريات'))).toBe('purchases');
    expect(resolveDashboardInsightsFocus(normalizeQuery('حلل المصاريف'))).toBe('expenses');
    expect(resolveDashboardInsightsFocus(normalizeQuery('هل الربحية سيئة؟'))).toBe('profitability');
    expect(resolveDashboardInsightsFocus(normalizeQuery('وش أهم التنبيهات؟'))).toBe('alerts');
    expect(resolveDashboardInsightsFocus(normalizeQuery('كيف وضع الشهر؟'))).toBe('overview');
  });

  it('resolveDashboardInsightsFocus detects English purchase / expense / profitability / alerts phrasing', () => {
    expect(resolveDashboardInsightsFocus(normalizeQuery('purchase analysis'))).toBe('purchases');
    expect(resolveDashboardInsightsFocus(normalizeQuery('expense analysis'))).toBe('expenses');
    expect(resolveDashboardInsightsFocus(normalizeQuery('profit margin'))).toBe('profitability');
    expect(resolveDashboardInsightsFocus(normalizeQuery('net profit'))).toBe('profitability');
    expect(resolveDashboardInsightsFocus(normalizeQuery('list warnings'))).toBe('alerts');
    expect(resolveDashboardInsightsFocus(normalizeQuery('financial alerts'))).toBe('alerts');
  });

  it('resolveEffectiveDashboardInsightsFocus uses legacy kind when wording is neutral', () => {
    expect(resolveEffectiveDashboardInsightsFocus(normalizeQuery('كيف وضع الشهر؟'), 'general')).toBe('overview');
    expect(resolveEffectiveDashboardInsightsFocus(normalizeQuery('سؤال محايد'), 'purchases')).toBe('purchases');
    expect(resolveEffectiveDashboardInsightsFocus(normalizeQuery('سؤال محايد'), 'profit')).toBe('profitability');
  });

  it('Arabic purchases focus lists purchase-sourced warnings only', async () => {
    const merged: CombinedInsightWarning[] = [
      {
        id: 'supplier_x',
        severity: 'warning',
        category: 'purchases',
        metricBasis: 'invoice_period',
        titleAr: 'عنوان موردين',
        titleEn: 'Supplier title',
        detailAr: 'تفاصيل.',
        detailEn: 'Details.',
        source: 'purchases',
      },
      {
        id: 'expense_ratio_to_sales',
        severity: 'warning',
        category: 'expenses',
        metricBasis: 'accounting_pl',
        titleAr: 'مصروفات لوحة',
        titleEn: 'Dash expense',
        detailAr: 'x',
        detailEn: 'x',
        source: 'dashboard',
      },
    ];
    const q = normalizeQuery('حلل المشتريات');
    const ctx = mkCtx({
      query: q,
      period: null,
      now: refDate,
      reportingInsightsAggregatorService: {
        getExtendedInsights: jest.fn().mockResolvedValue(mkExtendedWithMergedWarnings(merged)),
      },
    });
    const out = await dashboardInsightsHandler.process!(ctx);
    expect(out?.answerAr).toContain('عنوان موردين');
    expect(out?.answerAr).not.toContain('مصروفات لوحة');
    const combined = `${out?.answerAr}\n${out?.answerEn}`;
    for (const key of RAW_PAYLOAD_KEYS) {
      expect(combined).not.toContain(key);
    }
  });

  it('Arabic expenses focus lists expense-sourced or expense-category warnings', async () => {
    const merged: CombinedInsightWarning[] = [
      {
        id: 'supplier_x',
        severity: 'warning',
        category: 'purchases',
        metricBasis: 'invoice_period',
        titleAr: 'موردين',
        titleEn: 'Suppliers',
        detailAr: 'p',
        detailEn: 'p',
        source: 'purchases',
      },
      {
        id: 'expense_spike',
        severity: 'warning',
        category: 'expenses',
        metricBasis: 'accounting_pl',
        titleAr: 'قفزة مصاريف',
        titleEn: 'Expense spike',
        detailAr: 'e',
        detailEn: 'e',
        source: 'expenses',
      },
    ];
    const q = normalizeQuery('حلل المصاريف');
    const ctx = mkCtx({
      query: q,
      period: null,
      now: refDate,
      reportingInsightsAggregatorService: {
        getExtendedInsights: jest.fn().mockResolvedValue(mkExtendedWithMergedWarnings(merged)),
      },
    });
    const out = await dashboardInsightsHandler.process!(ctx);
    expect(out?.answerAr).toContain('قفزة مصاريف');
    expect(out?.answerAr).not.toContain('موردين');
    for (const key of RAW_PAYLOAD_KEYS) {
      expect(`${out?.answerAr}\n${out?.answerEn}`).not.toContain(key);
    }
  });

  it('profitability focus lists profit insight ids', async () => {
    const merged: CombinedInsightWarning[] = [
      {
        id: 'purchase_ratio_to_sales',
        severity: 'warning',
        category: 'purchases',
        metricBasis: 'accounting_pl',
        titleAr: 'مشتريات',
        titleEn: 'Purchases',
        detailAr: 'p',
        detailEn: 'p',
        source: 'dashboard',
      },
      {
        id: 'net_profit_margin',
        severity: 'warning',
        category: 'profit',
        metricBasis: 'accounting_pl',
        titleAr: 'هامش ربح',
        titleEn: 'Profit margin',
        detailAr: 'pr',
        detailEn: 'pr',
        source: 'dashboard',
      },
    ];
    const q = normalizeQuery('profit margin');
    const ctx = mkCtx({
      query: q,
      period: null,
      now: refDate,
      reportingInsightsAggregatorService: {
        getExtendedInsights: jest.fn().mockResolvedValue(mkExtendedWithMergedWarnings(merged)),
      },
    });
    const out = await dashboardInsightsHandler.process!(ctx);
    expect(out?.answerEn).toContain('Profit margin');
    expect(out?.answerEn).not.toContain('Purchases');
    for (const key of RAW_PAYLOAD_KEYS) {
      expect(`${out?.answerAr}\n${out?.answerEn}`).not.toContain(key);
    }
  });

  it('alerts focus prioritizes critical and warning severities', async () => {
    const merged: CombinedInsightWarning[] = [
      {
        id: 'info_sales_note',
        severity: 'info',
        category: 'sales',
        metricBasis: 'operational_sales',
        titleAr: 'معلومة',
        titleEn: 'Info only',
        detailAr: 'i',
        detailEn: 'i',
        source: 'dashboard',
      },
      {
        id: 'negative_profit_warning',
        severity: 'critical',
        category: 'profit',
        metricBasis: 'accounting_pl',
        titleAr: 'حرج',
        titleEn: 'Critical',
        detailAr: 'c',
        detailEn: 'c',
        source: 'dashboard',
      },
    ];
    const q = normalizeQuery('list warnings');
    const ctx = mkCtx({
      query: q,
      period: null,
      now: refDate,
      reportingInsightsAggregatorService: {
        getExtendedInsights: jest.fn().mockResolvedValue(mkExtendedWithMergedWarnings(merged)),
      },
    });
    const out = await dashboardInsightsHandler.process!(ctx);
    expect(out?.answerAr).toMatch(/حرج/);
    expect(out?.answerAr).not.toContain('• [لوحة] معلومة');
    for (const key of RAW_PAYLOAD_KEYS) {
      expect(`${out?.answerAr}\n${out?.answerEn}`).not.toContain(key);
    }
  });

  it('unknown-ish general question uses overview (mixed bullets up to three)', async () => {
    const merged: CombinedInsightWarning[] = [
      {
        id: 'a',
        severity: 'warning',
        category: 'purchases',
        metricBasis: 'accounting_pl',
        titleAr: 'أول',
        titleEn: 'First',
        detailAr: '1',
        detailEn: '1',
        source: 'dashboard',
      },
      {
        id: 'b',
        severity: 'warning',
        category: 'expenses',
        metricBasis: 'accounting_pl',
        titleAr: 'ثاني',
        titleEn: 'Second',
        detailAr: '2',
        detailEn: '2',
        source: 'dashboard',
      },
      {
        id: 'c',
        severity: 'info',
        category: 'sales',
        metricBasis: 'operational_sales',
        titleAr: 'ثالث',
        titleEn: 'Third',
        detailAr: '3',
        detailEn: '3',
        source: 'dashboard',
      },
      {
        id: 'd',
        severity: 'info',
        category: 'sales',
        metricBasis: 'operational_sales',
        titleAr: 'رابع',
        titleEn: 'Fourth',
        detailAr: '4',
        detailEn: '4',
        source: 'dashboard',
      },
    ];
    const q = normalizeQuery('كيف وضع الشهر؟');
    const ctx = mkCtx({
      query: q,
      period: parsePeriod(q, refDate),
      now: refDate,
      reportingInsightsAggregatorService: {
        getExtendedInsights: jest.fn().mockResolvedValue(mkExtendedWithMergedWarnings(merged)),
      },
    });
    const out = await dashboardInsightsHandler.process!(ctx);
    expect((out?.answerAr.match(/•/g) || []).length).toBe(3);
    expect(out?.answerAr).not.toContain('رابع');
    for (const key of RAW_PAYLOAD_KEYS) {
      expect(`${out?.answerAr}\n${out?.answerEn}`).not.toContain(key);
    }
  });

  it('purchases focus with no purchase warnings: area-specific message plus overall compact summary', async () => {
    const merged: CombinedInsightWarning[] = [
      {
        id: 'expense_ratio_to_sales',
        severity: 'warning',
        category: 'expenses',
        metricBasis: 'accounting_pl',
        titleAr: 'مصروفات فقط',
        titleEn: 'Expenses only',
        detailAr: 'e',
        detailEn: 'e',
        source: 'dashboard',
      },
    ];
    const q = normalizeQuery('حلل المشتريات');
    const ctx = mkCtx({
      query: q,
      period: null,
      now: refDate,
      reportingInsightsAggregatorService: {
        getExtendedInsights: jest.fn().mockResolvedValue(mkExtendedWithMergedWarnings(merged)),
      },
    });
    const out = await dashboardInsightsHandler.process!(ctx);
    expect(out?.answerAr).toContain('لا توجد تنبيهات محددة في مجال المشتريات');
    expect(out?.answerAr).toContain('ملخص التنبيهات: 1 إجمالي');
    expect(out?.answerAr).not.toContain('•');
    for (const key of RAW_PAYLOAD_KEYS) {
      expect(`${out?.answerAr}\n${out?.answerEn}`).not.toContain(key);
    }
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
