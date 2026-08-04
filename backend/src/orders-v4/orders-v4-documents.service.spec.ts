import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { OrdersV4DocumentsService } from './orders-v4-documents.service';
import { OrdersV4PurchaseCorrectionService } from './orders-v4-purchase-correction.service';
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
    const service = new OrdersV4DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);

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

  it('allows smart editing during the last seven days even while another purchase is pending', async () => {
    const range = ordersV4ReopenDateRange('2026-08-03');
    const oldDate = new Date(range.gte);
    oldDate.setUTCDate(oldDate.getUTCDate() - 1);
    const documents = [
      { id: 'within-week', documentType: 'purchase', reversalOfId: null, status: 'received', documentDate: range.gte, createdByUserId: null },
      { id: 'older', documentType: 'purchase', reversalOfId: null, status: 'received', documentDate: oldDate, createdByUserId: null },
    ];
    const prisma = { ordersV4Document: { findMany: jest.fn().mockResolvedValue(documents), findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new OrdersV4DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    jest.useFakeTimers().setSystemTime(new Date('2026-08-03T12:00:00.000Z'));
    const result = await service.list('company-1', 'purchase');

    expect(result.map((row) => [row.id, row.canReopen])).toEqual([
      ['within-week', true],
      ['older', false],
    ]);

    prisma.ordersV4Document.findFirst.mockResolvedValue({ id: 'pending-purchase' });
    const withPending = await service.list('company-1', 'purchase');
    expect(withPending.map((row) => [row.id, row.canReopen])).toEqual([
      ['within-week', true],
      ['older', false],
    ]);
  });

  it('marks exactly the latest five received purchases as reopenable for the cashier', async () => {
    const documents = Array.from({ length: 6 }, (_, index) => ({
      id: `purchase-${index + 1}`,
      documentType: 'purchase',
      reversalOfId: null,
      status: 'received',
      documentDate: new Date('2026-08-03T00:00:00.000Z'),
      createdByUserId: null,
    }));
    const findMany = jest.fn()
      .mockResolvedValueOnce(documents)
      .mockResolvedValueOnce(documents.slice(0, 5).map(({ id }) => ({ id })));
    const prisma = { ordersV4Document: { findMany, findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new OrdersV4DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    const result = await service.list('company-1', 'purchase', undefined, undefined, undefined, 250, {}, 'cashier');

    expect(result.map((row) => [row.id, row.canReopen])).toEqual([
      ['purchase-1', true],
      ['purchase-2', true],
      ['purchase-3', true],
      ['purchase-4', true],
      ['purchase-5', true],
      ['purchase-6', false],
    ]);
    expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ take: 5 }));
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
    const service = new OrdersV4DocumentsService(prisma as never, posting as never, funds as never, {} as never, {} as never);

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

  it('previews the exact purchase total through the central conversion and calculation kernels without writes', async () => {
    const piece = { id: 'piece', code: 'piece', dimension: 'count', canonicalFactor: new Prisma.Decimal(1) };
    const box = { id: 'box', code: 'box', dimension: 'package', canonicalFactor: null };
    const carton = { id: 'carton', code: 'carton', dimension: 'package', canonicalFactor: null };
    const prisma = {
      ordersV4Item: { findMany: jest.fn().mockResolvedValue([{
        id: 'item-1', nameAr: 'سكر', itemType: 'purchased', kernelUnitId: 'piece',
        units: [piece, box, carton].map((unit) => ({ unitId: unit.id, isActive: true })),
        conversionVersions: [{ edges: [
          { id: 'carton-box', fromUnitId: 'carton', toUnitId: 'box', factor: new Prisma.Decimal(10), reversible: true, allowDimensionBridge: false },
          { id: 'box-piece', fromUnitId: 'box', toUnitId: 'piece', factor: new Prisma.Decimal(64), reversible: true, allowDimensionBridge: true },
        ] }],
      }]) },
      ordersV4Unit: { findMany: jest.fn().mockResolvedValue([piece, box, carton]) },
    };
    const service = new OrdersV4DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    const result = await service.previewPurchase('company-1', [{
      itemId: 'item-1', quantity: '2', unitId: 'carton', unitPrice: '20', priceUnitId: 'box',
    }]);

    expect(result).toEqual(expect.objectContaining({
      kernelVersion: 4,
      calculationVersion: 1,
      lineCount: 1,
      totalAmount: '400',
    }));
    expect(result.lines[0]).toMatchObject({ itemId: 'item-1', lineTotal: '400' });
    expect(prisma.ordersV4Item.findMany).toHaveBeenCalledTimes(1);
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
    const service = new OrdersV4DocumentsService(prisma as never, posting as never, funds as never, {} as never, {} as never);

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

  it('corrects a received purchase atomically while preserving the newer pending purchase', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-03T12:00:00.000Z'));
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('cashier-1');
    const unit = { id: 'piece', code: 'piece', nameAr: 'حبة', dimension: 'count', canonicalFactor: new Prisma.Decimal(1) };
    const original = {
      id: 'received-1', status: 'received', revision: 2, documentType: 'purchase', reversalOfId: null,
      documentDate: new Date('2026-08-02T00:00:00.000Z'), paymentMethod: 'custody', calculationVersion: 1,
      calculationSnapshot: { kernelVersion: 4 },
    };
    const replacement = { id: 'corrected-1', status: 'prepared', revision: 1 };
    const corrected = { id: 'corrected-1', status: 'received', lines: [] };
    const findFirst = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce({ id: 'pending-2' });
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: {
        findFirst,
        create: jest.fn().mockResolvedValue(replacement),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(corrected),
      },
      ordersV4Location: { findFirst: jest.fn().mockResolvedValue({ id: 'main' }) },
      ordersV4Item: { findMany: jest.fn().mockResolvedValue([{
        id: 'item-1', nameAr: 'سكر', itemType: 'purchased', trackInventory: true,
        inventoryUnitId: 'piece', kernelUnitId: 'piece',
        units: [{ unitId: 'piece', isActive: true }], sections: [], conversionVersions: [],
      }]) },
      ordersV4Unit: { findMany: jest.fn().mockResolvedValue([unit]) },
      ordersV4DocumentLine: {
        deleteMany: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'corrected-line-1' }),
      },
      ordersV4PriceHistory: { create: jest.fn() },
      ordersV4ItemUnit: { updateMany: jest.fn() },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const posting = { lockKeys: jest.fn(), postReceipt: jest.fn().mockResolvedValue({}) };
    const funds = { postPurchase: jest.fn().mockResolvedValue({}) };
    const reversal = { reverseInTransaction: jest.fn().mockResolvedValue({ id: 'reversal-1' }) };
    const correction = new OrdersV4PurchaseCorrectionService(reversal as never);
    const service = new OrdersV4DocumentsService(prisma as never, posting as never, funds as never, reversal as never, correction);

    const result = await service.receiveLatest('company-1', original.id, {
      editMode: 'correction', revision: 2, documentDate: '2026-08-02', paymentMethod: 'custody', locationId: 'main',
      idempotencyKey: 'correct-1', lines: [{ itemId: 'item-1', quantity: '3', unitId: 'piece', unitPrice: '12', priceUnitId: 'piece' }],
    });

    expect(result).toBe(corrected);
    expect(reversal.reverseInTransaction).toHaveBeenCalledWith(tx, 'company-1', original.id, expect.stringContaining('correction-reversal:'));
    expect(tx.ordersV4Document.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'prepared', requestHash: expect.any(String) }),
    }));
    expect(tx.ordersV4Document.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: original.id },
      data: expect.objectContaining({ calculationSnapshot: expect.objectContaining({ correctedByDocumentId: replacement.id }) }),
    }));
    expect(posting.postReceipt).toHaveBeenCalledWith(tx, expect.objectContaining({
      sourceId: replacement.id, quantity: new Prisma.Decimal(3), totalValue: new Prisma.Decimal(36),
    }));
    expect(funds.postPurchase).toHaveBeenCalledWith(tx, expect.objectContaining({ documentId: replacement.id }));
  });
});
