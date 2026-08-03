import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { OrdersV4ItemDefinitionService } from './orders-v4-item-definition.service';

describe('OrdersV4ItemDefinitionService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('publishes one immutable conversion version and activates the complete unit chain atomically', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('user-1');
    const savedItem = { id: 'item-1', inventoryUnitId: 'piece' };
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Item: {
        findFirst: jest.fn().mockResolvedValue({ id: 'item-1', kernelUnitId: 'piece', units: [], conversionVersions: [] }),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue(savedItem),
      },
      ordersV4Unit: { findMany: jest.fn().mockResolvedValue([
        { id: 'carton', code: 'carton', dimension: 'package', canonicalFactor: null },
        { id: 'box', code: 'box', dimension: 'package', canonicalFactor: null },
        { id: 'piece', code: 'piece', dimension: 'count', canonicalFactor: new Prisma.Decimal(1) },
      ]) },
      ordersV4DocumentLine: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4RecipeLine: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4RecipeVersion: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4ConversionVersion: {
        aggregate: jest.fn().mockResolvedValue({ _max: { version: null } }),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'conversion-1', edges: [] }),
      },
      ordersV4ItemUnit: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4ItemDefinitionService(prisma as never);

    const result = await service.save('company-1', 'item-1', {
      inventoryUnitId: 'piece',
      edges: [
        { fromUnitId: 'carton', toUnitId: 'box', factor: '10' },
        { fromUnitId: 'box', toUnitId: 'piece', factor: '64' },
      ],
      units: [{ unitId: 'carton', isOrderEnabled: true, lastPrice: '120' }],
    });

    expect(tx.ordersV4ConversionVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ version: 1, status: 'published' }),
    }));
    expect(tx.ordersV4ItemUnit.upsert).toHaveBeenCalledTimes(3);
    expect(tx.ordersV4Item.update).toHaveBeenCalledWith({ where: { id: 'item-1' }, data: { inventoryUnitId: 'piece' } });
    expect(result).toEqual({ item: savedItem, conversionVersionId: 'conversion-1' });
  });
});
