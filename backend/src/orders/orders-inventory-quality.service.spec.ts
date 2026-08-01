import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { OrdersInventoryQualityService } from './orders-inventory-quality.service';

function qualityService(prisma: object) {
  const client = Object.assign(
    Object.create(TenantPrismaService.prototype) as TenantPrismaService,
    prisma,
  );
  return new OrdersInventoryQualityService(client);
}

describe('OrdersInventoryQualityService', () => {
  it('reports verified when active inventory rows have snapshots and no old shisha rows remain', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{
        purchaseTotal: 4n,
        purchaseMissing: 0n,
        saleTotal: 6n,
        saleVerified: 6n,
        saleMissing: 0n,
        saleInvalid: 0n,
        shishaSettings: 0n,
        shishaMovements: 0n,
        shishaStocktakes: 0n,
      }]),
    };
    const prisma = { withTenant: jest.fn((callback) => callback(tx)) };
    const service = qualityService(prisma);

    await expect(service.getDataQuality('company-1')).resolves.toEqual({
      status: 'verified',
      checkedAt: expect.any(String),
      legacy: {
        shishaSettingsRows: 0,
        shishaMovementRows: 0,
        shishaStocktakeRows: 0,
        shishaTotalRows: 0,
        purchaseItemsWithoutSnapshot: 0,
      },
      estimated: { saleItemsFromCurrentRecipe: 0 },
      snapshots: {
        purchases: { totalItems: 4, verifiedItems: 4, missingItems: 0 },
        consumption: { totalItems: 6, verifiedItems: 6, missingItems: 0, invalidItems: 0 },
      },
    });
    expect(prisma.withTenant).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reports each legacy and estimated source when review is required', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{
        purchaseTotal: 5n,
        purchaseMissing: 2n,
        saleTotal: 7n,
        saleVerified: 3n,
        saleMissing: 1n,
        saleInvalid: 3n,
        shishaSettings: 1n,
        shishaMovements: 5n,
        shishaStocktakes: 2n,
      }]),
    };
    const prisma = { withTenant: jest.fn((callback) => callback(tx)) };
    const service = qualityService(prisma);

    await expect(service.getDataQuality('company-1')).resolves.toEqual(expect.objectContaining({
      status: 'needs_review',
      legacy: {
        shishaSettingsRows: 1,
        shishaMovementRows: 5,
        shishaStocktakeRows: 2,
        shishaTotalRows: 8,
        purchaseItemsWithoutSnapshot: 2,
      },
      estimated: { saleItemsFromCurrentRecipe: 4 },
      snapshots: {
        purchases: { totalItems: 5, verifiedItems: 3, missingItems: 2 },
        consumption: { totalItems: 7, verifiedItems: 3, missingItems: 1, invalidItems: 3 },
      },
    }));
  });
});
