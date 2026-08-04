import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { OrdersV4DocumentReversalService } from './orders-v4-document-reversal.service';

function receivedPurchase() {
  return {
    id: 'purchase-1',
    documentNumber: 'REQ4-20260803-001',
    documentType: 'purchase',
    registrationEntryType: null,
    status: 'received',
    paymentMethod: 'custody',
    documentDate: new Date('2026-08-03T00:00:00.000Z'),
    sectionId: 'section-1',
    locationId: 'location-1',
    pettyCashAmount: new Prisma.Decimal(100),
    subtotal: new Prisma.Decimal(25),
    totalAmount: new Prisma.Decimal(25),
    operationalCost: new Prisma.Decimal(25),
    notes: 'ملاحظة',
    calculationVersion: 1,
    calculationSnapshot: { kernelVersion: 4, owner: 'orders-v4-calculation-kernel' },
    lines: [{
      id: 'line-1', itemId: 'item-1', lineNumber: 1, itemNameSnapshot: 'سكر',
      inputQuantity: new Prisma.Decimal(1), inputUnitId: 'carton',
      baseQuantity: new Prisma.Decimal(10), baseUnitId: 'piece',
      unitPrice: new Prisma.Decimal(25), priceUnitId: 'carton', priceQuantity: new Prisma.Decimal(1),
      lineTotal: new Prisma.Decimal(25), operationalCost: new Prisma.Decimal(25),
      conversionVersionId: 'conversion-1', recipeVersionId: null,
      cancellationReasons: null, cancellationNote: null,
      conversionSnapshot: { input: { factor: '10' } }, recipeSnapshot: null, costSnapshot: null,
      calculationSnapshot: { kernelVersion: 4 },
    }],
  };
}

describe('OrdersV4DocumentReversalService reopen workflow', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-03T12:00:00.000Z')));
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('atomically reverses the received latest purchase and creates an editable prepared replacement', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('cashier-1');
    const original = receivedPurchase();
    const reversal = { id: 'reversal-1' };
    const replacement = { id: 'replacement-1', status: 'prepared', lines: [] };
    const inventoryEntry = {
      id: 'ledger-1', itemId: 'item-1', inventoryUnitId: 'piece', locationId: 'location-1',
      quantityDelta: new Prisma.Decimal(10), valueDelta: new Prisma.Decimal(25), unitCost: new Prisma.Decimal('2.5'),
      conversionVersionId: null, recipeVersionId: null,
    };
    const custodyEntry = { id: 'custody-1', amountDelta: new Prisma.Decimal(-25) };
    const documentFindFirst = jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where.idempotencyKey) return null;
      if (where.id === original.id && where.documentType === 'purchase') return original;
      if (where.status === 'prepared') return null;
      if (where.id === original.id) return original;
      if (where.reversalOfId) return null;
      return null;
    });
    const documentCreate = jest.fn().mockImplementation(({ data }: { data: { reversalOfId?: string | null } }) => (
      data.reversalOfId ? reversal : replacement
    ));
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: {
        findFirst: documentFindFirst,
        findMany: jest.fn().mockResolvedValue([{ id: original.id }]),
        create: documentCreate,
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(replacement),
      },
      ordersV4DocumentLine: { create: jest.fn() },
      ordersV4InventoryLedgerEntry: { findMany: jest.fn().mockResolvedValue([inventoryEntry]) },
      ordersV4CustodyLedgerEntry: { findMany: jest.fn().mockResolvedValue([custodyEntry]) },
      ordersV4Item: { findMany: jest.fn().mockResolvedValue([{ id: 'item-1', kernelUnitId: 'piece', conversionVersions: [] }]) },
      ordersV4Unit: { findMany: jest.fn().mockResolvedValue([{ id: 'piece', code: 'piece', dimension: 'count', canonicalFactor: new Prisma.Decimal(1) }]) },
      ordersV4ConversionVersion: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4PriceHistory: { findFirst: jest.fn().mockResolvedValue(null) },
      ordersV4ItemUnit: { updateMany: jest.fn() },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const posting = { lockKeys: jest.fn(), postReversal: jest.fn() };
    const funds = { postReversals: jest.fn() };
    const service = new OrdersV4DocumentReversalService(prisma as never, posting as never, funds as never);

    const result = await service.reopenPurchase('company-1', original.id, 'reopen-key-1', 'cashier');

    expect(result).toBe(replacement);
    expect(documentCreate).toHaveBeenCalledTimes(2);
    expect(documentCreate.mock.calls[0][0].data).toMatchObject({
      status: 'reversed', reversalOfId: original.id,
    });
    expect(documentCreate.mock.calls[1][0].data).toMatchObject({
      status: 'prepared', documentType: 'purchase', idempotencyKey: 'reopen-key-1',
      calculationSnapshot: expect.objectContaining({
        operation: 'reopen-replacement', reopenedFromDocumentId: original.id, reversalDocumentId: reversal.id,
      }),
    });
    expect(tx.ordersV4DocumentLine.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        documentId: replacement.id,
        itemId: 'item-1',
        calculationSnapshot: expect.objectContaining({ reopenedFromLineId: 'line-1' }),
      }),
    }));
    expect(tx.ordersV4Document.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: original.id }, data: expect.objectContaining({ status: 'reversed' }),
    }));
    expect(tx.ordersV4Document.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: original.id },
      data: expect.objectContaining({ calculationSnapshot: expect.objectContaining({ reopenedByDocumentId: replacement.id }) }),
    }));
    expect(posting.lockKeys).toHaveBeenCalled();
    expect(posting.postReversal).toHaveBeenCalledWith(tx, expect.objectContaining({
      companyId: 'company-1', sourceId: reversal.id, original: inventoryEntry,
    }));
    expect(funds.postReversals).toHaveBeenCalledWith(tx, expect.objectContaining({
      companyId: 'company-1', reversalDocumentId: reversal.id, originals: [custodyEntry],
    }));
  });

  it('rejects a cashier request outside the latest five received purchases', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('cashier-1');
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(receivedPurchase()),
        findMany: jest.fn().mockResolvedValue([
          { id: 'purchase-6' }, { id: 'purchase-5' }, { id: 'purchase-4' }, { id: 'purchase-3' }, { id: 'purchase-2' },
        ]),
      },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentReversalService(prisma as never, {} as never, {} as never);

    await expect(service.reopenPurchase('company-1', 'purchase-1', 'cashier-reopen-6', 'cashier'))
      .rejects.toThrow('يمكن للكاشير تعديل آخر 5 طلبات مستلمة فقط');
  });

  it('rejects reopening a received purchase older than the seven-day owner window', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('owner-1');
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ ...receivedPurchase(), id: 'older-purchase', documentDate: new Date('2026-07-27T00:00:00.000Z') }),
      },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentReversalService(prisma as never, {} as never, {} as never);

    await expect(service.reopenPurchase('company-1', 'older-purchase', 'reopen-key-2'))
      .rejects.toThrow('إعادة الفتح متاحة للطلبات المستلمة خلال آخر 7 أيام فقط');
  });

  it('prevents opening a second editable purchase at the same time', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('owner-1');
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(receivedPurchase())
          .mockResolvedValueOnce({ id: 'pending-purchase' }),
      },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentReversalService(prisma as never, {} as never, {} as never);

    await expect(service.reopenPurchase('company-1', 'purchase-1', 'reopen-key-3'))
      .rejects.toThrow('يوجد طلب بانتظار الاستلام؛ استلمه قبل إعادة فتح طلب آخر');
  });
});
