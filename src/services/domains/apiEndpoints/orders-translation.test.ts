import { beforeEach, describe, expect, it, vi } from 'vitest';
import { previewOrderProductTranslations } from './orders';

vi.mock('../../core/apiHttp', () => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

import { apiPost } from '../../core/apiHttp';

describe('previewOrderProductTranslations', () => {
  beforeEach(() => {
    vi.mocked(apiPost).mockReset();
  });

  it('uses the extended timeout required for a reviewed AI translation batch', async () => {
    vi.mocked(apiPost).mockResolvedValueOnce({
      success: true,
      data: { suggestions: [], totalMissing: 0, truncated: false },
    });

    await previewOrderProductTranslations('company 1', 'order');

    expect(apiPost).toHaveBeenCalledWith(
      '/api/v1/orders/products/translation-preview?companyId=company%201',
      { productType: 'order', limit: 50 },
      { timeout: 90_000 },
    );
  });
});
