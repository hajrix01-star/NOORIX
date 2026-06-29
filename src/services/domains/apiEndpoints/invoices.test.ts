import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '../../core/apiHttp';
import { getInvoiceCreatorFilterOptions } from './invoices';

vi.mock('../../core/apiHttp', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  safeFetch: vi.fn(),
  parseResponse: vi.fn(),
  getApiBaseUrl: vi.fn(() => 'http://localhost:3000'),
  throwIfApiFailed: (res: { success?: boolean; error?: string }, fallbackMessage = 'طلب فشل') => {
    if (!res?.success) throw new Error(res?.error || fallbackMessage);
  },
}));

const mockedApiGet = vi.mocked(apiGet);

describe('invoice endpoints', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
  });

  it('preserves creator filter API failures instead of returning an empty successful list', async () => {
    mockedApiGet.mockResolvedValueOnce({ success: false, error: 'creator filter failed' });

    await expect(getInvoiceCreatorFilterOptions('company-1')).resolves.toEqual({
      success: false,
      error: 'creator filter failed',
    });
  });

  it('normalizes creator filter users only after a successful API response', async () => {
    mockedApiGet.mockResolvedValueOnce({
      success: true,
      data: { users: [{ id: 'u1' }] },
    });

    await expect(getInvoiceCreatorFilterOptions('company-1')).resolves.toEqual({
      success: true,
      data: { users: [{ id: 'u1' }] },
    });
  });
});
