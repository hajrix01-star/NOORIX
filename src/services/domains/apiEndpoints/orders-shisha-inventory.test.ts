import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPost } from '../../core/apiHttp';
import {
  createShishaInventoryPurchase,
  createShishaInventoryStocktake,
  initializeShishaInventory,
} from './orders';

vi.mock('../../core/apiHttp', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

const mockedApiPost = vi.mocked(apiPost);

describe('shisha inventory write endpoints', () => {
  beforeEach(() => {
    mockedApiPost.mockReset();
    mockedApiPost.mockResolvedValue({ success: true, data: {} });
  });

  it('sends companyId only in the initialize query string', async () => {
    await initializeShishaInventory({
      companyId: 'company 1',
      startDate: '2026-07-27',
      headsPerKg: '39',
      tobaccoQuantity: '21.692',
      tobaccoUnit: 'kg',
      hoses: '0',
      charcoalCartons: '5',
      charcoalPacks: '0',
      charcoalPieces: '0',
    });

    expect(mockedApiPost).toHaveBeenCalledWith(
      '/api/v1/orders/shisha-inventory/initialize?companyId=company%201',
      expect.not.objectContaining({ companyId: expect.anything() }),
    );
  });

  it('sends companyId only in the purchase query string', async () => {
    await createShishaInventoryPurchase({
      companyId: 'company-1',
      transactionDate: '2026-07-27',
      materialType: 'tobacco',
      quantity: '8',
      unit: 'kg',
    });

    expect(mockedApiPost).toHaveBeenCalledWith(
      '/api/v1/orders/shisha-inventory/purchases?companyId=company-1',
      expect.not.objectContaining({ companyId: expect.anything() }),
    );
  });

  it('sends companyId only in the stocktake query string', async () => {
    await createShishaInventoryStocktake({
      companyId: 'company-1',
      stocktakeDate: '2026-07-27',
      tobaccoQuantity: '21.692',
      tobaccoUnit: 'kg',
      hoses: '0',
      charcoalCartons: '5',
      charcoalPacks: '0',
      charcoalPieces: '0',
    });

    expect(mockedApiPost).toHaveBeenCalledWith(
      '/api/v1/orders/shisha-inventory/stocktakes?companyId=company-1',
      expect.not.objectContaining({ companyId: expect.anything() }),
    );
  });
});
