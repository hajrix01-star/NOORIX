import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { OrdersV4InventoryService } from './orders-v4-inventory.service';

describe('OrdersV4InventoryService stocktake conversion', () => {
  afterEach(() => jest.restoreAllMocks());

  it('converts every physical packaging unit centrally before posting the stocktake', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('user-1');
    const stocktake = { id: 'stocktake-1', stocktakeNumber: 'STK4-1' };
    const tx = {
      ordersV4Stocktake: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(stocktake),
        findUniqueOrThrow: jest.fn().mockResolvedValue(stocktake),
      },
      ordersV4Location: { findFirst: jest.fn().mockResolvedValue({ id: 'main' }) },
      ordersV4Item: { findMany: jest.fn().mockResolvedValue([{
        id: 'item-1', inventoryUnitId: 'piece', kernelUnitId: 'piece',
        units: [{ unitId: 'carton' }, { unitId: 'box' }, { unitId: 'piece' }],
        conversionVersions: [{ edges: [
          { id: 'carton-box', fromUnitId: 'carton', toUnitId: 'box', factor: new Prisma.Decimal(10), reversible: true, allowDimensionBridge: false },
          { id: 'box-piece', fromUnitId: 'box', toUnitId: 'piece', factor: new Prisma.Decimal(64), reversible: true, allowDimensionBridge: true },
        ] }],
      }]) },
      ordersV4Unit: { findMany: jest.fn().mockResolvedValue([
        { id: 'piece', code: 'piece', dimension: 'count', canonicalFactor: new Prisma.Decimal(1) },
        { id: 'box', code: 'box', dimension: 'package', canonicalFactor: null },
        { id: 'carton', code: 'carton', dimension: 'package', canonicalFactor: null },
      ]) },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const posting = { lockKeys: jest.fn(), postStocktakeAdjustment: jest.fn().mockResolvedValue({}) };
    const service = new OrdersV4InventoryService(prisma as never, posting as never);

    await service.createStocktake('company-1', {
      stocktakeDate: '2026-08-03', locationId: 'main', idempotencyKey: 'request-1',
      lines: [{ itemId: 'item-1', physicalUnits: [
        { unitId: 'carton', quantity: '2' },
        { unitId: 'box', quantity: '3' },
        { unitId: 'piece', quantity: '4' },
      ] }],
    });

    expect(posting.postStocktakeAdjustment).toHaveBeenCalledWith(tx, expect.objectContaining({
      itemId: 'item-1', inventoryUnitId: 'piece', physicalQuantity: new Prisma.Decimal(1476),
    }));
  });
});
