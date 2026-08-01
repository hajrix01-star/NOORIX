import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { OrdersCatalogService } from './orders-catalog.service';
import { OrdersCatalogTranslationService } from './orders-catalog-translation.service';
import { OrdersService } from './orders.service';

describe('OrdersService write transactions', () => {
  const product = {
    id: 'product-1',
    nameAr: 'مادة اختبار',
    unit: 'piece',
    variants: [],
    inventoryConversions: [],
    conversionTemplate: null,
  };

  function createService() {
    const transaction = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      order: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'order-1', items: [] }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'order-1' }),
      },
      orderItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderProduct: {
        findMany: jest.fn().mockResolvedValue([product]),
        findUnique: jest.fn().mockResolvedValue({ variants: [] }),
        update: jest.fn().mockResolvedValue({ id: product.id }),
      },
    };
    const withTenant = jest.fn(
      (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );
    const prisma = Object.assign(
      Object.create(TenantPrismaService.prototype) as TenantPrismaService,
      { withTenant },
    );
    const service = new OrdersService(
      prisma,
      Object.create(OrdersCatalogService.prototype) as OrdersCatalogService,
      Object.create(OrdersCatalogTranslationService.prototype) as OrdersCatalogTranslationService,
    );
    return { service, transaction, withTenant };
  }

  function inTenant<T>(operation: () => Promise<T>): Promise<T> {
    let promise: Promise<T> | undefined;
    TenantContext.run('tenant-1', null, () => {
      promise = operation();
    });
    if (!promise) throw new Error('Tenant operation was not started');
    return promise;
  }

  it('creates the order, snapshots, and last price inside one tenant transaction', async () => {
    const { service, transaction, withTenant } = createService();

    await inTenant(() => service.create('company-1', {
      orderDate: '2026-08-01',
      orderType: 'transfer',
      items: [{
        productId: product.id,
        unit: 'piece',
        quantity: '2',
        unitPrice: '7.5',
      }],
    }));

    expect(withTenant).toHaveBeenCalledTimes(1);
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        totalAmount: new Prisma.Decimal(15),
        items: {
          create: [expect.objectContaining({
            quantityMultiplier: new Prisma.Decimal(1),
            inventoryBaseQuantitySnapshot: new Prisma.Decimal(2),
          })],
        },
      }),
    }));
    expect(transaction.orderProduct.update).toHaveBeenCalledTimes(1);
  });

  it('replaces order items and updates totals within the same locked transaction', async () => {
    const { service, transaction, withTenant } = createService();
    transaction.order.findFirst
      .mockResolvedValueOnce({ id: 'order-1', orderType: 'internal' })
      .mockResolvedValueOnce({ id: 'order-1', items: [] });

    await service.update('company-1', 'order-1', {
      items: [{
        productId: product.id,
        unit: 'piece',
        quantity: '3',
        unitPrice: '5',
      }],
    });

    expect(withTenant).toHaveBeenCalledTimes(1);
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.orderItem.deleteMany).toHaveBeenCalledWith({ where: { orderId: 'order-1' } });
    expect(transaction.orderItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        orderId: 'order-1',
        quantityMultiplier: new Prisma.Decimal(1),
        inventoryBaseQuantitySnapshot: new Prisma.Decimal(3),
      })],
    });
    expect(transaction.order.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ totalAmount: new Prisma.Decimal(15) }),
    }));
    expect(transaction.orderProduct.update).toHaveBeenCalledTimes(1);
  });
});
