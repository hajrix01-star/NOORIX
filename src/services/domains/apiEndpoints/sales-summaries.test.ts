import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '../../core/apiHttp';
import { fetchAllSalesSummariesForExport, getDailySalesSummaries } from './sales-summaries';

vi.mock('../../core/apiHttp', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  throwIfApiFailed: (res: { success?: boolean; error?: string }, fallbackMessage = 'طلب فشل') => {
    if (!res?.success) throw new Error(res?.error || fallbackMessage);
  },
}));

const mockedApiGet = vi.mocked(apiGet);

describe('fetchAllSalesSummariesForExport', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
  });

  it('throws instead of returning partial summaries when a later page fails', async () => {
    mockedApiGet
      .mockResolvedValueOnce({
        success: true,
        data: {
          items: Array.from({ length: 150 }, (_, i) => ({ id: `summary-${i}` })),
          dayRows: [],
          pageSummary: { rowCount: 150, customerCount: 0, totalAmount: 0, avgPerCustomer: 0 },
          total: 151,
          page: 1,
          pageSize: 150,
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'sales summaries failed',
      });

    await expect(
      fetchAllSalesSummariesForExport('company-1', '2026-06-01', '2026-06-30', undefined),
    ).rejects.toThrow('sales summaries failed');
  });

  it('rejects responses missing the official backend page summary', async () => {
    mockedApiGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 50,
      },
    });

    const res = await getDailySalesSummaries('company-1');

    expect(res.success).toBe(false);
    expect(res.error).toContain('pageSummary');
  });
});
