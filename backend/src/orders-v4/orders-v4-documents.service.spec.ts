import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { TenantContext } from '../common/tenant-context';
import { OrdersV4DocumentsService } from './orders-v4-documents.service';
import { OrdersV4PurchaseCorrectionService } from './orders-v4-purchase-correction.service';
import { ordersV4CashierEditDateRange } from './orders-v4-reopen.policy';

describe('OrdersV4DocumentsService purchase workflow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('applies section, category, item, payment, status and search filters before the result limit', async () => {
    const findMany = jest.fn().mockResolvedValue([{
      id: 'document-1', documentType: 'purchase', reversalOfId: null, status: 'received',
      documentDate: ordersV4CashierEditDateRange().lte, createdByUserId: null,
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

  it('allows cashier editing and receipt only within the last ten days', async () => {
    const range = ordersV4CashierEditDateRange('2026-08-03');
    const oldDate = new Date(range.gte);
    oldDate.setUTCDate(oldDate.getUTCDate() - 1);
    const documents = [
      { id: 'within-window', documentType: 'purchase', reversalOfId: null, status: 'received', documentDate: range.gte, createdByUserId: null },
      { id: 'older', documentType: 'purchase', reversalOfId: null, status: 'received', documentDate: oldDate, createdByUserId: null },
      { id: 'old-prepared', documentType: 'purchase', reversalOfId: null, status: 'prepared', documentDate: oldDate, createdByUserId: null },
    ];
    const prisma = { ordersV4Document: { findMany: jest.fn().mockResolvedValue(documents), findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new OrdersV4DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    jest.useFakeTimers().setSystemTime(new Date('2026-08-03T12:00:00.000Z'));
    const result = await service.list('company-1', 'purchase', undefined, undefined, undefined, 250, {}, 'cashier');

    expect(result.map((row) => [row.id, row.canReopen])).toEqual([
      ['within-window', true],
      ['older', false],
      ['old-prepared', false],
    ]);
    expect(result.find((row) => row.id === 'old-prepared')?.canReceive).toBe(false);

    prisma.ordersV4Document.findFirst.mockResolvedValue({ id: 'pending-purchase' });
    const withPending = await service.list('company-1', 'purchase', undefined, undefined, undefined, 250, {}, 'cashier');
    expect(withPending.map((row) => [row.id, row.canReopen])).toEqual([
      ['within-window', true],
      ['older', false],
      ['old-prepared', false],
    ]);
  });

  it('allows only delegated historical purchases to reopen for cashier', async () => {
    const documents = [
      { id: 'fresh-prepared', documentType: 'purchase', reversalOfId: null, status: 'prepared', documentDate: new Date('2026-08-03T00:00:00.000Z'), createdByUserId: null },
      { id: 'delegated-old', documentType: 'purchase', reversalOfId: null, status: 'received', documentDate: new Date('2026-07-01T00:00:00.000Z'), createdByUserId: null, calculationSnapshot: { ownerReopenDelegatedAt: '2026-08-03T10:00:00.000Z' } },
      { id: 'old', documentType: 'purchase', reversalOfId: null, status: 'received', documentDate: new Date('2026-07-01T00:00:00.000Z'), createdByUserId: null, calculationSnapshot: {} },
    ];
    const findMany = jest.fn().mockResolvedValue(documents);
    const prisma = { ordersV4Document: { findMany, findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new OrdersV4DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    const result = await service.list('company-1', 'purchase', undefined, undefined, undefined, 250, {}, 'cashier');

    expect(result.map((row) => [row.id, row.canReceive, row.canReopen, row.ownerReopenedForCashier])).toEqual([
      ['fresh-prepared', true, false, false],
      ['delegated-old', false, true, true],
      ['old', false, false, false],
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('creates a prepared purchase with kernel-calculated quantities and totals', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('user-1');
    const document = { id: 'document-1', documentNumber: 'REQ4-1' };
    const unit = { id: 'piece', code: 'piece', nameAr: 'حبة', dimension: 'count', canonicalFactor: new Prisma.Decimal(1) };
    const tx = {
      $executeRaw: jest.fn(),
      idempotencyKey: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(document),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...document, status: 'prepared', lines: [] }),
      },
      ordersV4Location: { findFirst: jest.fn().mockResolvedValue({ id: 'main' }) },
      ordersV4Section: { findFirst: jest.fn() },
      ordersV4Item: { findMany: jest.fn().mockResolvedValue([{
        id: 'item-1', nameAr: 'سكر', itemType: 'purchased', isActive: true, trackInventory: true,
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

  it('receives an eligible purchase and posts price, inventory and custody atomically', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('cashier-1');
    const unit = { id: 'piece', code: 'piece', nameAr: 'حبة', dimension: 'count', canonicalFactor: new Prisma.Decimal(1) };
    const tx = {
      $executeRaw: jest.fn(),
      idempotencyKey: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue({ id: 'document-1', status: 'prepared', revision: 1, documentDate: new Date('2026-08-03T00:00:00.000Z'), calculationSnapshot: {} }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'newer-1' }, { id: 'newer-2' }, { id: 'newer-3' }, { id: 'newer-4' }, { id: 'document-1' },
        ]),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'document-1', status: 'received', lines: [] }),
      },
      ordersV4Location: { findFirst: jest.fn().mockResolvedValue({ id: 'main' }) },
      ordersV4Item: { findMany: jest.fn().mockResolvedValue([{
        id: 'item-1', nameAr: 'سكر', itemType: 'purchased', isActive: true, trackInventory: true,
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
    const correction = {
      loadEffectInTransaction: jest.fn().mockResolvedValue({ inventoryEntries: [], custodyEntries: [] }),
      reverseInventoryInTransaction: jest.fn(),
      reverseCustodyInTransaction: jest.fn(),
      refreshHistoricalPricesInTransaction: jest.fn(),
    };
    const service = new OrdersV4DocumentsService(prisma as never, posting as never, funds as never, {} as never, correction as never);

    const result = await service.receivePurchase('company-1', 'document-1', {
      revision: 1, documentDate: '2026-08-03', paymentMethod: 'custody', locationId: 'main',
      idempotencyKey: 'receive-1', lines: [{ itemId: 'item-1', quantity: '2', unitId: 'piece', unitPrice: '12', priceUnitId: 'piece' }],
    }, 'cashier');

    expect(result).toMatchObject({ id: 'document-1', status: 'received' });
    expect(posting.postReceipt).toHaveBeenCalledWith(tx, expect.objectContaining({
      itemId: 'item-1', quantity: new Prisma.Decimal(2), totalValue: new Prisma.Decimal(24),
    }));
    expect(funds.postPurchase).toHaveBeenCalledWith(tx, expect.objectContaining({
      documentId: 'document-1', purchaseAmount: new Prisma.Decimal(24),
    }));
    expect(tx.ordersV4PriceHistory.create).toHaveBeenCalledTimes(1);
    const storedReplay = tx.idempotencyKey.upsert.mock.calls[0][0].create.resultJson;
    tx.idempotencyKey.findFirst.mockResolvedValue({ resultJson: storedReplay });
    await expect(service.receivePurchase('company-1', 'document-1', {
      editMode: 'correction', revision: 1, documentDate: '2026-08-03', paymentMethod: 'custody', locationId: 'main',
      idempotencyKey: 'receive-1', lines: [{ itemId: 'item-1', quantity: '2', unitId: 'piece', unitPrice: '12', priceUnitId: 'piece' }],
    }, 'cashier')).rejects.toThrow('مفتاح منع تكرار الاستلام مستخدم لطلب أو محتوى مختلف');
    await expect(service.receivePurchase('company-1', 'different-document', {
      revision: 1, documentDate: '2026-08-03', paymentMethod: 'custody', locationId: 'main',
      idempotencyKey: 'receive-1', lines: [{ itemId: 'item-1', quantity: '2', unitId: 'piece', unitPrice: '12', priceUnitId: 'piece' }],
    }, 'cashier')).rejects.toThrow('مفتاح منع تكرار الاستلام مستخدم لطلب أو محتوى مختلف');
  });

  it.skip('rejects owner receipt outside the retired seven-day and latest-five windows', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('owner-1');
    const tx = {
      $executeRaw: jest.fn(),
      idempotencyKey: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'old-prepared', status: 'prepared', revision: 1,
          documentDate: new Date('2020-01-01T00:00:00.000Z'), calculationSnapshot: {},
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'newer-1' }, { id: 'newer-2' }, { id: 'newer-3' }, { id: 'newer-4' }, { id: 'newer-5' },
        ]),
      },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await expect(service.receivePurchase('company-1', 'old-prepared', {
      revision: 1, documentDate: '2020-01-01', paymentMethod: 'custody', locationId: 'main',
      idempotencyKey: 'old-owner-receipt', lines: [{ itemId: 'item-1', quantity: '1', unitId: 'piece', unitPrice: '1', priceUnitId: 'piece' }],
    }, 'owner')).rejects.toThrow('الاستلام متاح خلال آخر 7 أيام أو ضمن آخر 5 طلبات');
  });

  it.skip('rejects the sixth active purchase under the retired latest-five window', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('cashier-1');
    const tx = {
      $executeRaw: jest.fn(),
      idempotencyKey: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue({ id: 'purchase-6', status: 'prepared', revision: 1, calculationSnapshot: {} }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'purchase-1' }, { id: 'purchase-2' }, { id: 'purchase-3' }, { id: 'purchase-4' }, { id: 'purchase-5' },
        ]),
      },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const posting = { postReceipt: jest.fn() };
    const funds = { postPurchase: jest.fn() };
    const service = new OrdersV4DocumentsService(prisma as never, posting as never, funds as never, {} as never, {} as never);

    await expect(service.receivePurchase('company-1', 'purchase-6', {
      revision: 1, documentDate: '2026-08-03', paymentMethod: 'custody', locationId: 'main',
      idempotencyKey: 'receive-6', lines: [{ itemId: 'item-1', quantity: '1', unitId: 'piece', unitPrice: '1', priceUnitId: 'piece' }],
    }, 'cashier')).rejects.toThrow('يمكن للكاشير تعديل أو استلام آخر 5 طلبات فقط');

    expect(posting.postReceipt).not.toHaveBeenCalled();
    expect(funds.postPurchase).not.toHaveBeenCalled();
  });

  it('returns an exact idempotent retry even after the purchase leaves the latest-five window', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('cashier-1');
    const input = {
      revision: 1, documentDate: '2026-08-03', paymentMethod: 'custody' as const, locationId: 'main',
      idempotencyKey: 'receive-retry', lines: [{ itemId: 'item-1', quantity: '1', unitId: 'piece', unitPrice: '1', priceUnitId: 'piece' }],
    };
    const expectedHash = createHash('sha256').update(JSON.stringify({
      documentId: 'old-received',
      editMode: 'standard',
      revision: input.revision,
      documentDate: input.documentDate,
      paymentMethod: input.paymentMethod,
      sectionId: null,
      locationId: input.locationId,
      pettyCashAmount: null,
      notes: null,
      lines: input.lines.map((line) => ({ ...line, quantity: String(line.quantity), unitPrice: String(line.unitPrice) })),
    })).digest('hex');
    const received = {
      id: 'old-received', status: 'received', revision: 2,
      calculationSnapshot: { receiveIdempotencyKey: input.idempotencyKey, receiveRequestHash: expectedHash },
      lines: [],
    };
    const tx = {
      $executeRaw: jest.fn(),
      idempotencyKey: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue(received),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(received),
      },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await expect(service.receivePurchase('company-1', received.id, input, 'cashier')).resolves.toBe(received);
    expect(tx.ordersV4Document.findMany).not.toHaveBeenCalled();
  });

  it('corrects a received purchase atomically while preserving the newer pending purchase', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-03T12:00:00.000Z'));
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('cashier-1');
    const unit = { id: 'piece', code: 'piece', nameAr: 'حبة', dimension: 'count', canonicalFactor: new Prisma.Decimal(1) };
    const original = {
      id: 'received-1', status: 'received', revision: 2, documentType: 'purchase', reversalOfId: null,
      documentDate: new Date('2026-08-02T00:00:00.000Z'), paymentMethod: 'custody', calculationVersion: 1,
      sectionId: null, locationId: 'old-main', pettyCashAmount: new Prisma.Decimal(0),
      subtotal: new Prisma.Decimal(28), totalAmount: new Prisma.Decimal(28), operationalCost: new Prisma.Decimal(28),
      calculationSnapshot: { kernelVersion: 4 }, section: null, location: { id: 'old-main' },
      lines: [{
        id: 'old-line-1', itemId: 'item-1', lineNumber: 1, itemNameSnapshot: 'سكر',
        inputQuantity: new Prisma.Decimal(2), inputUnitId: 'piece',
        baseQuantity: new Prisma.Decimal(2), baseUnitId: 'piece',
        unitPrice: new Prisma.Decimal(10), priceUnitId: 'piece', priceQuantity: new Prisma.Decimal(2),
        lineTotal: new Prisma.Decimal(20), operationalCost: new Prisma.Decimal(20),
        conversionVersionId: null, recipeVersionId: null, cancellationReasons: null, cancellationNote: null,
        conversionSnapshot: {}, recipeSnapshot: null, costSnapshot: null, calculationSnapshot: {},
        item: { id: 'item-1' }, inputUnit: unit, baseUnit: unit, priceUnit: unit,
      }, {
        id: 'old-line-2', itemId: 'item-2', lineNumber: 2, itemNameSnapshot: 'صنف محذوف',
        inputQuantity: new Prisma.Decimal(4), inputUnitId: 'piece',
        baseQuantity: new Prisma.Decimal(4), baseUnitId: 'piece',
        unitPrice: new Prisma.Decimal(2), priceUnitId: 'piece', priceQuantity: new Prisma.Decimal(4),
        lineTotal: new Prisma.Decimal(8), operationalCost: new Prisma.Decimal(8),
        conversionVersionId: null, recipeVersionId: null, cancellationReasons: null, cancellationNote: null,
        conversionSnapshot: {}, recipeSnapshot: null, costSnapshot: null, calculationSnapshot: {},
        item: { id: 'item-2' }, inputUnit: unit, baseUnit: unit, priceUnit: unit,
      }],
    };
    const replacement = { id: 'corrected-1', status: 'prepared', revision: 1 };
    const corrected = { id: 'corrected-1', status: 'received', lines: [] };
    const originalLedger = [
      {
        id: 'old-ledger-3', itemId: 'item-2', inventoryUnitId: 'piece', locationId: 'old-main',
        quantityDelta: new Prisma.Decimal(4), valueDelta: new Prisma.Decimal(8), unitCost: new Prisma.Decimal(2),
        conversionVersionId: null, recipeVersionId: null,
      },
      {
        id: 'old-ledger-2', itemId: 'item-1', inventoryUnitId: 'piece', locationId: 'old-main',
        quantityDelta: new Prisma.Decimal(0), valueDelta: new Prisma.Decimal(-2), unitCost: new Prisma.Decimal(10),
        conversionVersionId: null, recipeVersionId: null,
      },
      {
        id: 'old-ledger-1', itemId: 'item-1', inventoryUnitId: 'piece', locationId: 'old-main',
        quantityDelta: new Prisma.Decimal(2), valueDelta: new Prisma.Decimal(20), unitCost: new Prisma.Decimal(10),
        conversionVersionId: null, recipeVersionId: null,
      },
    ];
    const originalCustody = [{ id: 'old-custody-1', amountDelta: new Prisma.Decimal(-28) }];
    const findFirst = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(original);
    const tx = {
      $executeRaw: jest.fn(),
      idempotencyKey: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      ordersV4Document: {
        findFirst,
        findMany: jest.fn().mockResolvedValue([{ id: 'pending-2' }, { id: original.id }]),
        create: jest.fn().mockResolvedValue(replacement),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(corrected),
      },
      ordersV4Location: { findFirst: jest.fn().mockResolvedValue({ id: 'main' }) },
      ordersV4InventoryLedgerEntry: { findMany: jest.fn().mockResolvedValue(originalLedger) },
      ordersV4CustodyLedgerEntry: { findMany: jest.fn().mockResolvedValue(originalCustody) },
      ordersV4ConversionVersion: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4Item: { findMany: jest.fn().mockResolvedValue([
        {
          id: 'item-1', nameAr: 'سكر', itemType: 'purchased', isActive: true, trackInventory: true,
          inventoryUnitId: 'piece', kernelUnitId: 'piece',
          units: [{ unitId: 'piece', isActive: true }], sections: [], conversionVersions: [],
        },
        {
          id: 'item-2', nameAr: 'صنف محذوف', itemType: 'purchased', isActive: false, trackInventory: false,
          inventoryUnitId: 'piece', kernelUnitId: 'piece',
          units: [{ unitId: 'piece', isActive: true }], sections: [], conversionVersions: [],
        },
        {
          id: 'item-3', nameAr: 'صنف مضاف', itemType: 'purchased', isActive: true, trackInventory: true,
          inventoryUnitId: 'piece', kernelUnitId: 'piece',
          units: [{ unitId: 'piece', isActive: true }], sections: [], conversionVersions: [],
        },
      ]) },
      ordersV4Unit: { findMany: jest.fn().mockResolvedValue([unit]) },
      ordersV4DocumentLine: {
        deleteMany: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'corrected-line-1' }),
      },
      ordersV4PriceHistory: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
      ordersV4ItemUnit: { updateMany: jest.fn() },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const posting = { lockKeys: jest.fn(), postReversal: jest.fn().mockResolvedValue({}), postReceipt: jest.fn().mockResolvedValue({}) };
    const funds = { postReversals: jest.fn().mockResolvedValue(undefined), postPurchase: jest.fn().mockResolvedValue(undefined) };
    const reversal = { reverseInTransaction: jest.fn().mockResolvedValue({ id: 'reversal-1' }) };
    const correction = new OrdersV4PurchaseCorrectionService(posting as never, funds as never);
    const service = new OrdersV4DocumentsService(prisma as never, posting as never, funds as never, reversal as never, correction);

    const result = await service.receivePurchase('company-1', original.id, {
      editMode: 'correction', revision: 2, documentDate: '2026-08-02', paymentMethod: 'custody', locationId: 'main',
      idempotencyKey: 'correct-1', lines: [
        { itemId: 'item-1', quantity: '3', unitId: 'piece', unitPrice: '12', priceUnitId: 'piece' },
        { itemId: 'item-3', quantity: '5', unitId: 'piece', unitPrice: '3', priceUnitId: 'piece' },
      ],
    }, 'cashier');

    expect(result).toBe(corrected);
    expect(reversal.reverseInTransaction).not.toHaveBeenCalled();
    expect(tx.ordersV4InventoryLedgerEntry.findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1', sourceId: original.id, entryType: { not: 'reversal' } },
      orderBy: { sequence: 'desc' },
    });
    expect(tx.ordersV4CustodyLedgerEntry.findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1', documentId: original.id, entryType: { not: 'reversal' } },
      orderBy: { sequence: 'asc' },
    });
    expect(tx.ordersV4Document.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'prepared', requestHash: expect.any(String) }),
    }));
    expect(tx.ordersV4Document.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: original.id },
      data: expect.objectContaining({ calculationSnapshot: expect.objectContaining({ correctedByDocumentId: replacement.id }) }),
    }));
    expect(posting.postReversal).toHaveBeenCalledTimes(3);
    expect(posting.postReversal).toHaveBeenCalledWith(tx, expect.objectContaining({
      sourceId: replacement.id, original: originalLedger[1],
    }));
    expect(posting.postReversal).toHaveBeenCalledWith(tx, expect.objectContaining({
      sourceId: replacement.id, original: originalLedger[0],
    }));
    expect(posting.postReceipt).toHaveBeenCalledTimes(2);
    expect(posting.postReceipt).toHaveBeenCalledWith(tx, expect.objectContaining({
      sourceId: replacement.id, itemId: 'item-1', locationId: 'main', quantity: new Prisma.Decimal(3), totalValue: new Prisma.Decimal(36),
    }));
    expect(posting.postReceipt).toHaveBeenCalledWith(tx, expect.objectContaining({
      sourceId: replacement.id, itemId: 'item-3', quantity: new Prisma.Decimal(5), totalValue: new Prisma.Decimal(15),
    }));
    expect(funds.postReversals).toHaveBeenCalledWith(tx, expect.objectContaining({
      reversalDocumentId: replacement.id, originals: originalCustody,
    }));
    expect(funds.postPurchase).toHaveBeenCalledWith(tx, expect.objectContaining({
      documentId: replacement.id, purchaseAmount: new Prisma.Decimal(51),
    }));
    expect(tx.ordersV4PriceHistory.findFirst).toHaveBeenCalledTimes(2);
    expect(tx.ordersV4ItemUnit.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1', itemId: 'item-2', unitId: 'piece' },
      data: { lastPrice: null, lastPriceAt: null },
    });
  });
});
