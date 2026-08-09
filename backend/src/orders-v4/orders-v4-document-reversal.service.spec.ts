import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
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

  it('opens an eligible received purchase read-only without inventory, custody or document writes', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('cashier-1');
    const original = receivedPurchase();
    const editable = { ...original, section: null, location: { id: 'location-1' } };
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue(original),
        findMany: jest.fn().mockResolvedValue([{ id: original.id }]),
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(editable),
      },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const posting = { lockKeys: jest.fn(), postReversal: jest.fn() };
    const funds = { postReversals: jest.fn() };
    const service = new OrdersV4DocumentReversalService(prisma as never, posting as never, funds as never);

    const result = await service.reopenPurchase('company-1', original.id, 'reopen-key-1', 'cashier');

    expect(result).toEqual(expect.objectContaining({ id: original.id, editMode: 'correction' }));
    expect(tx.ordersV4Document.create).not.toHaveBeenCalled();
    expect(tx.ordersV4Document.update).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(posting.lockKeys).not.toHaveBeenCalled();
    expect(posting.postReversal).not.toHaveBeenCalled();
    expect(funds.postReversals).not.toHaveBeenCalled();
  });

  it.skip('rejects a cashier request outside the retired latest-five purchase window', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('cashier-1');
    const tx = {
      $executeRaw: jest.fn(),
      idempotencyKey: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue(receivedPurchase()),
        findMany: jest.fn().mockResolvedValue([
          { id: 'purchase-6' }, { id: 'purchase-5' }, { id: 'purchase-4' }, { id: 'purchase-3' }, { id: 'purchase-2' },
        ]),
      },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentReversalService(prisma as never, {} as never, {} as never);

    await expect(service.reopenPurchase('company-1', 'purchase-1', 'cashier-reopen-6', 'cashier'))
      .rejects.toThrow('يمكن للكاشير تعديل أو استلام آخر 5 طلبات فقط');
  });

  it.skip('rejects reopening a received purchase older than the retired seven-day owner window', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('owner-1');
    const tx = {
      $executeRaw: jest.fn(),
      idempotencyKey: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue({ ...receivedPurchase(), id: 'older-purchase', documentDate: new Date('2026-07-27T00:00:00.000Z') }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'newer-1' }, { id: 'newer-2' }, { id: 'newer-3' }, { id: 'newer-4' }, { id: 'newer-5' },
        ]),
      },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentReversalService(prisma as never, {} as never, {} as never);

    await expect(service.reopenPurchase('company-1', 'older-purchase', 'reopen-key-2'))
      .rejects.toThrow('إعادة الفتح متاحة خلال آخر 7 أيام أو ضمن آخر 5 طلبات');
  });

  it('lets the owner correct an old purchase when it is still within the latest five', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('owner-1');
    const oldRecentPurchase = { ...receivedPurchase(), documentDate: new Date('2026-07-01T00:00:00.000Z') };
    const correctionDocument = { ...oldRecentPurchase, editMode: 'correction' };
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue(oldRecentPurchase),
        findMany: jest.fn().mockResolvedValue([{ id: oldRecentPurchase.id }, { id: 'newer-2' }]),
        findUniqueOrThrow: jest.fn().mockResolvedValue(correctionDocument),
      },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentReversalService(prisma as never, {} as never, {} as never);

    await expect(service.reopenPurchase('company-1', 'purchase-1', 'reopen-key-3'))
      .resolves.toMatchObject({ id: 'purchase-1', editMode: 'correction' });
    expect(tx.ordersV4Document.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'purchase-1' } }));

    expect(tx.ordersV4Document.findFirst).toHaveBeenCalledTimes(1);
  });

  it('allows the owner to open any received purchase regardless of age', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    const oldPurchase = { ...receivedPurchase(), documentDate: new Date('2020-01-01T00:00:00.000Z') };
    const editable = { ...oldPurchase, section: null, location: { id: 'location-1' } };
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue(oldPurchase),
        findUniqueOrThrow: jest.fn().mockResolvedValue(editable),
      },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentReversalService(prisma as never, {} as never, {} as never);

    await expect(service.reopenPurchase('company-1', oldPurchase.id, 'owner-any-date', 'owner'))
      .resolves.toMatchObject({ id: oldPurchase.id, editMode: 'correction' });
  });

  it('lets the owner delegate one historical purchase to the cashier with an auditable workflow marker', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    const oldPurchase = { ...receivedPurchase(), documentDate: new Date('2020-01-01T00:00:00.000Z') };
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue(oldPurchase),
        update: jest.fn().mockImplementation(async ({ data }: { data: { calculationSnapshot: unknown } }) => ({
          ...oldPurchase,
          calculationSnapshot: data.calculationSnapshot,
        })),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentReversalService(prisma as never, {} as never, {} as never);

    const result = await service.reopenPurchase('company-1', oldPurchase.id, 'delegate-old', 'owner', 'delegate', 'owner-1');

    expect(result).toMatchObject({ id: oldPurchase.id, ownerReopenedForCashier: true, editMode: 'correction' });
    expect(tx.ordersV4Document.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        calculationSnapshot: expect.objectContaining({
          ownerReopenDelegationIdempotencyKey: 'delegate-old',
          ownerReopenDelegatedByUserId: 'owner-1',
        }),
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ entity: 'orders_v4_purchase_owner_reopen', entityId: oldPurchase.id }),
    }));
  });

  it('allows a cashier to correct only the historical purchase delegated by the owner', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    const delegated = {
      ...receivedPurchase(),
      documentDate: new Date('2020-01-01T00:00:00.000Z'),
      calculationSnapshot: { ownerReopenDelegatedAt: '2026-08-03T12:00:00.000Z' },
    };
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: {
        findFirst: jest.fn().mockResolvedValue(delegated),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...delegated, section: null, location: { id: 'location-1' } }),
      },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentReversalService(prisma as never, {} as never, {} as never);

    await expect(service.reopenPurchase('company-1', delegated.id, 'cashier-delegated', 'cashier'))
      .resolves.toMatchObject({ id: delegated.id, editMode: 'correction' });
  });

  it('does not open another historical purchase for the cashier', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: { findFirst: jest.fn().mockResolvedValue({ ...receivedPurchase(), documentDate: new Date('2020-01-01T00:00:00.000Z') }) },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentReversalService(prisma as never, {} as never, {} as never);

    await expect(service.reopenPurchase('company-1', 'purchase-1', 'cashier-old', 'cashier'))
      .rejects.toThrow('يمكن للكاشير تعديل طلبات آخر 10 أيام فقط، أو الطلب الذي أعاد المالك فتحه له');
  });

  it('cancels only the business document own effect and excludes inherited reversal entries', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    const original = receivedPurchase();
    const reversalDocument = { id: 'reversal-1' };
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: {
        findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          if (where.idempotencyKey) return null;
          if (where.id === original.id) return original;
          return null;
        }),
        create: jest.fn().mockResolvedValue(reversalDocument),
        update: jest.fn(),
      },
      ordersV4InventoryLedgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4CustodyLedgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4Item: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4Unit: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4ConversionVersion: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4PriceHistory: { findFirst: jest.fn().mockResolvedValue(null) },
      ordersV4ItemUnit: { updateMany: jest.fn() },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentReversalService(prisma as never, { lockKeys: jest.fn() } as never, { postReversals: jest.fn() } as never);

    await expect(service.reverse('company-1', original.id, 'reverse-key')).resolves.toBe(reversalDocument);
    expect(tx.ordersV4InventoryLedgerEntry.findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1', sourceId: original.id, entryType: { not: 'reversal' } },
      orderBy: { sequence: 'desc' },
    });
    expect(tx.ordersV4CustodyLedgerEntry.findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1', documentId: original.id, entryType: { not: 'reversal' } },
      orderBy: { sequence: 'asc' },
    });
  });

  it('undoes a cancellation from the reversal-chain head including its reversal entries', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    const original = { ...receivedPurchase(), status: 'reversed' };
    const reversalHead = {
      ...original,
      id: 'reversal-1',
      reversalOfId: original.id,
      pettyCashAmount: original.pettyCashAmount.negated(),
      subtotal: original.subtotal.negated(),
      totalAmount: original.totalAmount.negated(),
      operationalCost: original.operationalCost.negated(),
      lines: [],
    };
    const undoDocument = { id: 'undo-1' };
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: {
        findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          if (where.idempotencyKey) return null;
          if (where.id === original.id) return original;
          if (where.reversalOfId === original.id) return reversalHead;
          return null;
        }),
        create: jest.fn().mockResolvedValue(undoDocument),
        update: jest.fn(),
      },
      ordersV4InventoryLedgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4CustodyLedgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4Item: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4Unit: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4ConversionVersion: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4PriceHistory: { findFirst: jest.fn().mockResolvedValue(null) },
      ordersV4ItemUnit: { updateMany: jest.fn() },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentReversalService(prisma as never, { lockKeys: jest.fn() } as never, { postReversals: jest.fn() } as never);

    await expect(service.undoReverse('company-1', original.id, 'undo-chain-key')).resolves.toBe(undoDocument);
    expect(tx.ordersV4InventoryLedgerEntry.findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1', sourceId: reversalHead.id },
      orderBy: { sequence: 'desc' },
    });
    expect(tx.ordersV4CustodyLedgerEntry.findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1', documentId: reversalHead.id },
      orderBy: { sequence: 'asc' },
    });
  });

  it.each([
    ['reverse', false],
    ['undo-reverse', true],
  ] as const)('serializes %s with the company purchase-window lock before the document lock', async (operation, undo) => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ operation, documentId: 'purchase-1' }))
      .digest('hex');
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4Document: { findFirst: jest.fn().mockResolvedValue({ id: 'undo-result', requestHash }) },
    };
    const prisma = { withTenant: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrdersV4DocumentReversalService(prisma as never, {} as never, {} as never);

    const result = undo
      ? service.undoReverse('company-1', 'purchase-1', 'undo-key')
      : service.reverse('company-1', 'purchase-1', 'reverse-key');
    await expect(result).resolves.toMatchObject({ id: 'undo-result' });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.$executeRaw.mock.calls[0][1]).toBe('orders-v4:receive:company-1');
    expect(tx.$executeRaw.mock.calls[1][1]).toBe('orders-v4:reverse:company-1:purchase-1');
  });
});
