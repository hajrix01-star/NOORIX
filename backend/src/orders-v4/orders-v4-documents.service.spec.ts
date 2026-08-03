import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { OrdersV4DocumentsService } from './orders-v4-documents.service';

describe('OrdersV4DocumentsService purchase workflow', () => {
  afterEach(() => jest.restoreAllMocks());

  it('creates a prepared purchase with kernel-calculated quantities and totals', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('user-1');
    const document = { id: 'document-1', documentNumber: 'REQ4-1' };
    const unit = { id: 'piece', code: 'piece', nameAr: 'حبة', dimension: 'count', canonicalFactor: new Prisma.Decimal(1) };
    const tx = {
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(document),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...document, status: 'prepared', lines: [] }),
      },
      ordersV4Location: { findFirst: jest.fn().mockResolvedValue({ id: 'main' }) },
      ordersV4Section: { findFirst: jest.fn() },
      ordersV4Item: { findMany: jest.fn().mockResolvedValue([{
        id: 'item-1', nameAr: 'سكر', itemType: 'purchased', trackInventory: true,
        inventoryUnitId: 'piece', kernelUnitId: 'piece', inventoryUnit: unit,
        units: [{ unitId: 'piece', isActive: true, isOrderEnabled: true, lastPrice: new Prisma.Decimal(12) }],
        conversionVersions: [], recipeVersions: [],
      }]) },
      ordersV4Unit: { findMany: jest.fn().mockResolvedValue([unit]) },
      ordersV4DocumentLine: { create: jest.fn().mockResolvedValue({ id: 'line-1' }) },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const posting = { lockKeys: jest.fn() };
    const funds = {};
    const service = new OrdersV4DocumentsService(prisma as never, posting as never, funds as never);

    const result = await service.create('company-1', {
      documentType: 'purchase', documentDate: '2026-08-03', paymentMethod: 'custody',
      locationId: 'main', idempotencyKey: 'purchase-1',
      lines: [{ itemId: 'item-1', quantity: '2', unitId: 'piece', unitPrice: '12', priceUnitId: 'piece' }],
    });

    expect(result).toMatchObject({ id: 'document-1', status: 'prepared' });
    const documentData = tx.ordersV4Document.create.mock.calls[0][0].data;
    const lineData = tx.ordersV4DocumentLine.create.mock.calls[0][0].data;
    expect(documentData.totalAmount.toString()).toBe('24');
    expect(documentData.operationalCost.toString()).toBe('24');
    expect(lineData.baseQuantity.toString()).toBe('2');
    expect(lineData.lineTotal.toString()).toBe('24');
    expect(posting.lockKeys).not.toHaveBeenCalled();
  });

  it('receives the latest purchase and posts price, inventory and custody atomically', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('cashier-1');
    const unit = { id: 'piece', code: 'piece', nameAr: 'حبة', dimension: 'count', canonicalFactor: new Prisma.Decimal(1) };
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue({ id: 'document-1', status: 'prepared', revision: 1, calculationSnapshot: {} }),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'document-1', status: 'received', lines: [] }),
      },
      ordersV4Location: { findFirst: jest.fn().mockResolvedValue({ id: 'main' }) },
      ordersV4Item: { findMany: jest.fn().mockResolvedValue([{
        id: 'item-1', nameAr: 'سكر', itemType: 'purchased', trackInventory: true,
        inventoryUnitId: 'piece', kernelUnitId: 'piece',
        units: [{ unitId: 'piece', isActive: true }], conversionVersions: [],
      }]) },
      ordersV4Unit: { findMany: jest.fn().mockResolvedValue([unit]) },
      ordersV4DocumentLine: {
        deleteMany: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'received-line-1' }),
      },
      ordersV4PriceHistory: { create: jest.fn() },
      ordersV4ItemUnit: { updateMany: jest.fn() },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const posting = { lockKeys: jest.fn(), postReceipt: jest.fn().mockResolvedValue({}) };
    const funds = { postPurchase: jest.fn().mockResolvedValue({}) };
    const service = new OrdersV4DocumentsService(prisma as never, posting as never, funds as never);

    const result = await service.receiveLatest('company-1', 'document-1', {
      revision: 1, documentDate: '2026-08-03', paymentMethod: 'custody', locationId: 'main',
      idempotencyKey: 'receive-1', lines: [{ itemId: 'item-1', quantity: '2', unitId: 'piece', unitPrice: '12', priceUnitId: 'piece' }],
    });

    expect(result).toMatchObject({ id: 'document-1', status: 'received' });
    expect(posting.postReceipt).toHaveBeenCalledWith(tx, expect.objectContaining({
      itemId: 'item-1', quantity: new Prisma.Decimal(2), totalValue: new Prisma.Decimal(24),
    }));
    expect(funds.postPurchase).toHaveBeenCalledWith(tx, expect.objectContaining({
      documentId: 'document-1', purchaseAmount: new Prisma.Decimal(24),
    }));
    expect(tx.ordersV4PriceHistory.create).toHaveBeenCalledTimes(1);
  });
});
