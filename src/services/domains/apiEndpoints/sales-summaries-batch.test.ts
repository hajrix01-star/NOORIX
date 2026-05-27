import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDailySalesSummariesSequential } from './sales-summaries-batch';

vi.mock('../../core/apiHttp', () => ({
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}));

import { apiPost, apiPatch } from '../../core/apiHttp';

describe('createDailySalesSummariesSequential', () => {
  beforeEach(() => {
    vi.mocked(apiPost).mockReset();
    vi.mocked(apiPatch).mockReset();
    vi.mocked(apiPatch).mockResolvedValue({ success: true, data: {} });
  });

  it('returns summaries in order', async () => {
    vi.mocked(apiPost)
      .mockResolvedValueOnce({ success: true, data: { summary: { id: 'a', shift: 'morning' } } })
      .mockResolvedValueOnce({ success: true, data: { summary: { id: 'b', shift: 'evening' } } });

    const res = await createDailySalesSummariesSequential({
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
    expect(apiPost).toHaveBeenCalledTimes(2);
    const firstBody = vi.mocked(apiPost).mock.calls[0][1] as Record<string, unknown>;
    expect(firstBody).not.toHaveProperty('idempotencyKey');
    expect(firstBody.shift).toBe('morning');
  });

  it('stops on first failure', async () => {
    vi.mocked(apiPost)
      .mockResolvedValueOnce({ success: true, data: { summary: { id: 'a' } } })
      .mockResolvedValueOnce({ success: false, error: 'فشل', code: 400 });

    const res = await createDailySalesSummariesSequential({
      companyId: 'c1',
      transactionDate: '2026-05-10',
      items: [
        { shift: 'morning', customerCount: 10, channels: [{ vaultId: 'v1', amount: '100' }] },
        { shift: 'evening', customerCount: 8, channels: [{ vaultId: 'v1', amount: '200' }] },
      ],
    });

    expect(res.success).toBe(false);
    expect(apiPost).toHaveBeenCalledTimes(2);
  });
});
