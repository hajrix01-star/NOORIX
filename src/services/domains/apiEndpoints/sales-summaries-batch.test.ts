import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postDailySalesSummaryBatch } from './sales-summaries-batch';

vi.mock('../../core/apiHttp', () => ({
  apiPost: vi.fn(),
}));

import { apiPost } from '../../core/apiHttp';

describe('postDailySalesSummaryBatch', () => {
  beforeEach(() => {
    vi.mocked(apiPost).mockReset();
  });

  it('posts the whole batch to the official summary-batch endpoint', async () => {
    vi.mocked(apiPost).mockResolvedValueOnce({
      success: true,
      data: { summaries: [{ id: 'a', shift: 'morning' }, { id: 'b', shift: 'evening' }] },
    });

    const res = await postDailySalesSummaryBatch({
      companyId: 'c1',
      transactionDate: '2026-05-10',
      items: [
        { shift: 'morning', customerCount: 10, channels: [{ vaultId: 'v1', amount: '100' }] },
        { shift: 'evening', customerCount: 8, channels: [{ vaultId: 'v1', amount: '200' }] },
      ],
      batchIdempotencyKey: 'batch-1',
    });

    expect(res.success).toBe(true);
    expect(res.data?.summaries).toHaveLength(2);
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith('/api/v1/sales/summary-batch', expect.objectContaining({
      companyId: 'c1',
      transactionDate: '2026-05-10',
      batchIdempotencyKey: 'batch-1',
      items: [
        expect.objectContaining({ shift: 'morning', customerCount: 10 }),
        expect.objectContaining({ shift: 'evening', customerCount: 8 }),
      ],
    }));
  });

  it('returns backend failure without falling back to sequential summary posts', async () => {
    vi.mocked(apiPost).mockResolvedValueOnce({ success: false, error: 'فشل', code: 400 });

    const res = await postDailySalesSummaryBatch({
      companyId: 'c1',
      transactionDate: '2026-05-10',
      items: [
        { shift: 'morning', customerCount: 10, channels: [{ vaultId: 'v1', amount: '100' }] },
        { shift: 'evening', customerCount: 8, channels: [{ vaultId: 'v1', amount: '200' }] },
      ],
    });

    expect(res.success).toBe(false);
    expect(apiPost).toHaveBeenCalledTimes(1);
  });
});
