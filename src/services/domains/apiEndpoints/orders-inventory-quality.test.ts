import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getInventoryDataQuality } from './orders';

vi.mock('../../core/apiHttp', () => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

import { apiGet } from '../../core/apiHttp';

describe('getInventoryDataQuality', () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset();
  });

  it('requests the company-scoped typed quality report', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({
      success: true,
      data: {
        status: 'verified',
        checkedAt: '2026-08-01T00:00:00.000Z',
        legacy: {
          shishaSettingsRows: 0,
          shishaMovementRows: 0,
          shishaStocktakeRows: 0,
          shishaTotalRows: 0,
          purchaseItemsWithoutSnapshot: 0,
        },
        estimated: { saleItemsFromCurrentRecipe: 0 },
        snapshots: {
          purchases: { totalItems: 0, verifiedItems: 0, missingItems: 0 },
          consumption: { totalItems: 0, verifiedItems: 0, missingItems: 0, invalidItems: 0 },
        },
      },
    });

    await getInventoryDataQuality('company-1');

    expect(apiGet).toHaveBeenCalledWith(
      '/api/v1/orders/inventory-data-quality',
      { companyId: 'company-1' },
    );
  });
});
