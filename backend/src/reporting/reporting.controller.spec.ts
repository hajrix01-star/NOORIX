import { ReportingController } from './reporting.controller';
import type { DashboardInsightsService } from './insights/dashboard-insights.service';

describe('ReportingController', () => {
  const payload = {
    schemaVersion: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    context: { companyId: 'c1', year: 2024, selectedMonth: 3, labels: {} },
    metrics: { accounting: {}, operational: {} },
    ratios: { purchaseToSales: null, expenseToSales: null, netProfitMargin: null, notes: [] },
    health: { score: null, band: 'unknown' as const, summaryAr: '', summaryEn: '' },
    insights: [],
    opportunities: [],
    warnings: [],
  };

  it('delegates to DashboardInsightsService with mapped date range and returns service result unchanged', async () => {
    const buildDashboardInsights = jest.fn().mockResolvedValue(payload);
    const controller = new ReportingController({
      buildDashboardInsights,
    } as unknown as DashboardInsightsService);

    const query = {
      companyId: 'c1',
      year: 2024,
      yearStart: '2024-01-01',
      yearEnd: '2024-12-31',
      dailyStart: '2024-03-01',
      dailyEnd: '2024-03-31',
      monthStart: '2024-03-01',
      monthEnd: '2024-03-31',
      periodStart: '2024-03-01',
      periodEnd: '2024-03-31',
      selectedMonth: 3,
      includeCancelledSales: true,
    };

    const out = await controller.getDashboardInsights(query as any);

    expect(buildDashboardInsights).toHaveBeenCalledTimes(1);
    expect(buildDashboardInsights).toHaveBeenCalledWith(
      'c1',
      {
        year: 2024,
        yearStart: '2024-01-01',
        yearEnd: '2024-12-31',
        dailyStart: '2024-03-01',
        dailyEnd: '2024-03-31',
        monthStart: '2024-03-01',
        monthEnd: '2024-03-31',
        periodStart: '2024-03-01',
        periodEnd: '2024-03-31',
        includeCancelledSales: true,
      },
      3,
    );
    expect(out).toBe(payload);
  });

  it('maps omitted optional dates to null and includeCancelledSales false', async () => {
    const buildDashboardInsights = jest.fn().mockResolvedValue(payload);
    const controller = new ReportingController({
      buildDashboardInsights,
    } as unknown as DashboardInsightsService);

    const query = {
      companyId: 'c2',
      year: 2025,
      yearStart: '2025-01-01',
      yearEnd: '2025-12-31',
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
    };

    await controller.getDashboardInsights(query as any);

    expect(buildDashboardInsights).toHaveBeenCalledWith(
      'c2',
      {
        year: 2025,
        yearStart: '2025-01-01',
        yearEnd: '2025-12-31',
        dailyStart: null,
        dailyEnd: null,
        monthStart: null,
        monthEnd: null,
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
        includeCancelledSales: false,
      },
      null,
    );
  });
});
