import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiHttp from './core/apiHttp';
import { getInsightThresholds, patchInsightThresholds, resetInsightThresholds } from './reportingInsightThresholdsApi';

describe('reportingInsightThresholdsApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getInsightThresholds calls GET with companyId', async () => {
    const spy = vi.spyOn(apiHttp, 'apiGet').mockResolvedValue({
      success: true,
      data: {
        companyId: 'co1',
        thresholds: {
          purchaseToSales: { warning: 0.1, critical: 0.2 },
          expenseToSales: { warning: 0.1, critical: 0.2 },
          netProfitMargin: { warningBelow: 0.05, criticalBelow: 0 },
        },
      },
    });
    await getInsightThresholds('co1');
    expect(spy).toHaveBeenCalledWith('/api/v1/reporting/insights/thresholds', { companyId: 'co1' });
  });

  it('patchInsightThresholds calls PATCH with body', async () => {
    const spy = vi.spyOn(apiHttp, 'apiPatch').mockResolvedValue({
      success: true,
      data: { companyId: 'co1', thresholds: {} as any },
    });
    await patchInsightThresholds({
      companyId: 'co1',
      purchaseToSales: { warning: 0.7 },
    });
    expect(spy).toHaveBeenCalledWith('/api/v1/reporting/insights/thresholds', {
      companyId: 'co1',
      purchaseToSales: { warning: 0.7 },
    });
  });

  it('resetInsightThresholds calls POST reset', async () => {
    const spy = vi.spyOn(apiHttp, 'apiPost').mockResolvedValue({
      success: true,
      data: { companyId: 'co1', thresholds: {} as any },
    });
    await resetInsightThresholds('co1');
    expect(spy).toHaveBeenCalledWith('/api/v1/reporting/insights/thresholds/reset', { companyId: 'co1' });
  });
});
