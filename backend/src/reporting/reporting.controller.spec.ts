import { ReportingController } from './reporting.controller';
import type { Request } from 'express';
import type { AuditLogService } from '../audit/audit-log.service';
import type { CompanyInsightThresholdSettingsService } from './insights/company-insight-threshold-settings.service';
import type { DashboardInsightsService } from './insights/dashboard-insights.service';
import type { GetDashboardInsightsQueryDto } from './dto/dashboard-insights-query.dto';
import type { PatchInsightThresholdsDto } from './dto/patch-insight-thresholds.dto';
import type { ResetInsightThresholdsDto } from './dto/reset-insight-thresholds.dto';

type ReportingRequest = Request & { user: { userId: string } };
type ReportingInsightsReader = Pick<DashboardInsightsService, 'buildDashboardInsights'>;
type ReportingThresholdSettings = Pick<
  CompanyInsightThresholdSettingsService,
  'getResolvedThresholds' | 'updateStoredThresholds' | 'resetStoredThresholds'
>;
type ReportingAuditLog = Pick<AuditLogService, 'log' | 'logUpdate'>;

describe('ReportingController', () => {
  const mkInsights = (buildDashboardInsights = jest.fn()): ReportingInsightsReader => ({
    buildDashboardInsights,
  });

  const mkThresholdSettings = (): ReportingThresholdSettings => ({
    getResolvedThresholds: jest.fn(),
    updateStoredThresholds: jest.fn(),
    resetStoredThresholds: jest.fn(),
  });

  const mkAudit = (): ReportingAuditLog => ({
    log: jest.fn().mockResolvedValue(undefined),
    logUpdate: jest.fn().mockResolvedValue(undefined),
  });

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
    const controller = new ReportingController(
      mkInsights(buildDashboardInsights),
      mkThresholdSettings(),
      mkAudit(),
    );

    const query: GetDashboardInsightsQueryDto = {
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

    const out = await controller.getDashboardInsights(query);

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
    const controller = new ReportingController(
      mkInsights(buildDashboardInsights),
      mkThresholdSettings(),
      mkAudit(),
    );

    const query: GetDashboardInsightsQueryDto = {
      companyId: 'c2',
      year: 2025,
      yearStart: '2025-01-01',
      yearEnd: '2025-12-31',
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
    };

    await controller.getDashboardInsights(query);

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

  it('getInsightThresholds delegates to CompanyInsightThresholdSettingsService', async () => {
    const buildDashboardInsights = jest.fn();
    const getResolvedThresholds = jest.fn().mockResolvedValue({
      purchaseToSales: { warning: 0.65, critical: 0.8 },
      expenseToSales: { warning: 0.35, critical: 0.5 },
      netProfitMargin: { warningBelow: 0.05, criticalBelow: 0 },
    });
    const controller = new ReportingController(
      mkInsights(buildDashboardInsights),
      { ...mkThresholdSettings(), getResolvedThresholds },
      mkAudit(),
    );

    const out = await controller.getInsightThresholds({ companyId: 'c1' });
    expect(getResolvedThresholds).toHaveBeenCalledWith('c1');
    expect(out).toEqual({
      companyId: 'c1',
      thresholds: {
        purchaseToSales: { warning: 0.65, critical: 0.8 },
        expenseToSales: { warning: 0.35, critical: 0.5 },
        netProfitMargin: { warningBelow: 0.05, criticalBelow: 0 },
      },
    });
  });

  it('patchInsightThresholds delegates with partial body', async () => {
    const resolvedSample = {
      purchaseToSales: { warning: 0.65, critical: 0.8 },
      expenseToSales: { warning: 0.35, critical: 0.5 },
      netProfitMargin: { warningBelow: 0.05, criticalBelow: 0 },
    };
    const getResolvedThresholds = jest.fn().mockResolvedValue(resolvedSample);
    const updateStoredThresholds = jest.fn().mockResolvedValue({
      purchaseToSales: { warning: 0.66, critical: 0.78 },
      expenseToSales: { warning: 0.35, critical: 0.5 },
      netProfitMargin: { warningBelow: 0.05, criticalBelow: 0 },
    });
    const audit = mkAudit();
    const controller = new ReportingController(
      mkInsights(),
      { ...mkThresholdSettings(), getResolvedThresholds, updateStoredThresholds },
      audit,
    );

    const body: PatchInsightThresholdsDto = {
      companyId: 'c1',
      purchaseToSales: { warning: 0.66, critical: 0.78 },
    };
    const out = await controller.patchInsightThresholds(
      body,
      { user: { userId: 'u1' } } as ReportingRequest,
    );
    expect(getResolvedThresholds).toHaveBeenCalledWith('c1');
    expect(updateStoredThresholds).toHaveBeenCalledWith('c1', {
      purchaseToSales: { warning: 0.66, critical: 0.78 },
      expenseToSales: undefined,
      netProfitMargin: undefined,
    });
    expect(audit.logUpdate).toHaveBeenCalled();
    expect(out.companyId).toBe('c1');
    expect(out.thresholds.purchaseToSales.critical).toBe(0.78);
  });

  it('resetInsightThresholds delegates', async () => {
    const defaults = {
      purchaseToSales: { warning: 0.65, critical: 0.8 },
      expenseToSales: { warning: 0.35, critical: 0.5 },
      netProfitMargin: { warningBelow: 0.05, criticalBelow: 0 },
    };
    const getResolvedThresholds = jest.fn().mockResolvedValue(defaults);
    const resetStoredThresholds = jest.fn().mockResolvedValue(defaults);
    const audit = mkAudit();
    const controller = new ReportingController(
      mkInsights(),
      { ...mkThresholdSettings(), getResolvedThresholds, resetStoredThresholds },
      audit,
    );

    const body: ResetInsightThresholdsDto = { companyId: 'c9' };
    const out = await controller.resetInsightThresholds(body, { user: { userId: 'u2' } } as ReportingRequest);
    expect(getResolvedThresholds).toHaveBeenCalledWith('c9');
    expect(resetStoredThresholds).toHaveBeenCalledWith('c9');
    expect(audit.log).toHaveBeenCalled();
    expect(out).toEqual({ companyId: 'c9', thresholds: defaults });
  });
});
