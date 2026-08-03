import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { OrdersV4DocumentsService } from './orders-v4-documents.service';
import { ordersV4ReopenDateRange } from './orders-v4-reopen.policy';

describe('OrdersV4DocumentsService purchase workflow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('applies section, category, item, payment, status and search filters before the result limit', async () => {
    const findMany = jest.fn().mockResolvedValue([{
      id: 'document-1', documentType: 'purchase', reversalOfId: null, status: 'received',
      documentDate: ordersV4ReopenDateRange().lte, createdByUserId: null,
    }]);
    const prisma = { ordersV4Document: { findMany, findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new OrdersV4DocumentsService(prisma as never, {} as never, {} as never, {} as never);

    const result = await service.list('company-1', 'purchase', '2026-07-01', '2026-07-31', undefined, 25, {
      search: 'سكر',
      sectionId: 'section-1',
      categoryId: 'category-1',
      itemId: 'item-1',
      paymentMethod: 'custody',
      status: 'received',
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 25,
      where: expect.objectContaining({
        companyId: 'company-1',
        documentType: 'purchase',
        sectionId: 'section-1',
        paymentMethod: 'custody',
        status: 'received',
        lines: { some: { itemId: 'item-1', item: { categoryId: 'category-1' } } },
        OR: expect.arrayContaining([
          { documentNumber: { contains: 'سكر', mode: 'insensitive' } },
          { lines: { some: { item: { category: { nameAr: { contains: 'سكر', mode: 'insensitive' } } } } } },
        ]),
      }),
    }));
    expect(result[0]).toMatchObject({ id: 'document-1', canReopen: true });
  });

  it('allows reopening received purchases from the last seven days and blocks it while another purchase is pending', async () => {
    const range = ordersV4ReopenDateRange('2026-08-03');
    const oldDate = new Date(range.gte);
    oldDate.setUTCDate(oldDate.getUTCDate() - 1);
    const documents = [
      { id: 'within-week', documentType: 'purchase', reversalOfId: null, status: 'received', documentDate: range.gte, createdByUserId: null },
      { id: 'older', documentType: 'purchase', reversalOfId: null, status: 'received', documentDate: oldDate, createdByUserId: null },
    ];
    const prisma = { ordersV4Document: { findMany: jest.fn().mockResolvedValue(documents), findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new OrdersV4DocumentsService(prisma as never, {} as never, {} as never, {} as never);

    jest.useFakeTimers().setSystemTime(new Date('2026-08-03T12:00:00.000Z'));
    const result = await service.list('company-1', 'purchase');

    expect(result.map((row) => [row.id, row.canReopen])).toEqual([
      ['within-week', true],
      ['older', false],
    ]);

    prisma.ordersV4Document.findFirst.mockResolvedValue({ id: 'pending-purchase' });
    const blocked = await service.list('company-1', 'purchase');
    expect(blocked.every((row) => row.canReopen === false)).toBe(true);
  });

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
    const service = new OrdersV4DocumentsService(prisma as never, posting as never, funds as never, {} as never);

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
    const service = new OrdersV4DocumentsService(prisma as never, posting as never, funds as never, {} as never);

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
