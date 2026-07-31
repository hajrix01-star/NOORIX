import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { saudiDateYmd } from '../hr/utils/hr-saudi-dates.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { OrdersInventoryService } from './orders-inventory.service';

function inventoryService(prisma: object) {
  const client = Object.assign(
    Object.create(TenantPrismaService.prototype) as TenantPrismaService,
    prisma,
  );
  return new OrdersInventoryService(client);
}

function transactionFixture(existingProductIds: string[] = []) {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    company: { findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }) },
    inventoryStocktake: {
      create: jest.fn().mockResolvedValue({ id: 'stocktake-1', lines: [] }),
    },
    inventoryStocktakeLine: {
      findMany: jest.fn().mockResolvedValue(existingProductIds.map((productId) => ({ productId }))),
    },
    $queryRaw: jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0 }]),
    orderProduct: {
      findMany: jest.fn()
        .mockResolvedValueOnce([{ id: 'product-1', unit: 'piece' }])
        .mockResolvedValueOnce([{
          id: 'product-1',
          nameAr: 'Product',
          nameEn: 'Product',
          productType: 'order',
          sections: [],
          sectionIds: [],
          unit: 'piece',
          inventoryConversions: null,
          conversionTemplate: null,
          recipe: null,
        }]),
    },
    orderItem: { findMany: jest.fn().mockResolvedValue([]) },
    staffOrderItem: { findMany: jest.fn().mockResolvedValue([]) },
    inventoryMovement: {
      groupBy: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe('OrdersInventoryService', () => {
  beforeEach(() => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'setSkipSetConfigForTransaction').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('rejects a stocktake outside the current Saudi day before opening a transaction', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = inventoryService(prisma);

    await expect(service.createStocktake('company-1', 'user-1', {
      stocktakeDate: '2000-01-01',
      lines: [{ productId: 'product-1', physicalQuantity: '1' }],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses a serializable snapshot and current unbounded stock sources', async () => {
    const tx = transactionFixture();
    const prisma = {
      $transaction: jest.fn(async (callback, options) => callback(tx, options)),
    };
    const service = inventoryService(prisma);

    await service.createStocktake('company-1', 'user-1', {
      stocktakeDate: saudiDateYmd(),
      lines: [{ productId: 'product-1', physicalQuantity: '2.000000' }],
    });

    expect(prisma.$transaction.mock.calls[0][1]).toEqual(expect.objectContaining({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }));
    const saleWhere = tx.staffOrderItem.findMany.mock.calls[0][0].where.staffOrder;
    expect(saleWhere).not.toHaveProperty('saleDate');
    expect(tx.orderItem.findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({
      inventoryBaseQuantitySnapshot: null,
    }));
    expect(tx.staffOrderItem.findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({
      inventoryConsumptionSnapshot: { equals: Prisma.DbNull },
    }));
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(tx.inventoryStocktake.create).toHaveBeenCalledTimes(1);
    expect(tx.inventoryMovement.createMany).toHaveBeenCalledTimes(1);
  });

  it('rejects recounting the same product on the same company day', async () => {
    const tx = transactionFixture(['product-1']);
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = inventoryService(prisma);

    await expect(service.createStocktake('company-1', 'user-1', {
      stocktakeDate: saudiDateYmd(),
      lines: [{ productId: 'product-1', physicalQuantity: '1' }],
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows another stocktake on the same day when it contains different products', async () => {
    const tx = transactionFixture([]);
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = inventoryService(prisma);

    await expect(service.createStocktake('company-1', 'user-1', {
      stocktakeDate: saudiDateYmd(),
      lines: [{ productId: 'product-1', physicalQuantity: '1' }],
    })).resolves.toEqual(expect.objectContaining({ id: 'stocktake-1' }));
  });

  it.each([
    ['P2002', ConflictException],
    ['P2034', ConflictException],
    ['P2003', BadRequestException],
    ['P2004', BadRequestException],
  ])('maps Prisma %s to an operational HTTP error', async (code, exceptionType) => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('inventory constraint', {
      code,
      clientVersion: '5.22.0',
    });
    const prisma = { $transaction: jest.fn().mockRejectedValue(prismaError) };
    const service = inventoryService(prisma);

    await expect(service.createStocktake('company-1', 'user-1', {
      stocktakeDate: saudiDateYmd(),
      lines: [{ productId: 'product-1', physicalQuantity: '1' }],
    })).rejects.toBeInstanceOf(exceptionType);
  });
});
