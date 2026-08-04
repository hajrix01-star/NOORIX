import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { OrdersV4FundsPostingService } from './orders-v4-funds-posting.service';
import { OrdersV4LedgerPostingService } from './orders-v4-ledger-posting.service';

describe('Orders V4 central posting services', () => {
  afterEach(() => jest.restoreAllMocks());

  it('serializes an inventory issue and persists the kernel result', async () => {
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('user-1');
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4InventoryLedgerEntry: {
        findFirst: jest.fn().mockResolvedValue({
          inventoryUnitId: 'piece', quantityAfter: new Prisma.Decimal(10),
          valueAfter: new Prisma.Decimal(50), averageUnitCostAfter: new Prisma.Decimal(5),
        }),
        create: jest.fn(async ({ data }: { data: unknown }) => data),
      },
    };
    const service = new OrdersV4LedgerPostingService();
    const result = await service.postIssue(tx as never, {
      tenantId: 'tenant-1', companyId: 'company-1', itemId: 'item-1', locationId: 'main',
      documentLineId: 'line-1', inventoryUnitId: 'piece', sourceId: 'document-1',
      sourceKey: 'document:1:line:1:issue', effectiveAt: new Date('2026-08-03'),
      quantity: new Prisma.Decimal(3), conversionVersionId: null, recipeVersionId: null,
      sourceSnapshot: { kernelVersion: 4 },
    });

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(result).toMatchObject({ entryType: 'issue', quantityAfter: new Prisma.Decimal(7), valueAfter: new Prisma.Decimal(35) });
  });

  it('posts a receipt through the same inventory kernel and updates weighted average cost', async () => {
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('user-1');
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4InventoryLedgerEntry: {
        findFirst: jest.fn().mockResolvedValue({
          inventoryUnitId: 'piece', quantityAfter: new Prisma.Decimal(10),
          valueAfter: new Prisma.Decimal(50), averageUnitCostAfter: new Prisma.Decimal(5),
        }),
        create: jest.fn(async ({ data }: { data: unknown }) => data),
      },
    };
    const service = new OrdersV4LedgerPostingService();
    const result = await service.postReceipt(tx as never, {
      tenantId: 'tenant-1', companyId: 'company-1', itemId: 'item-1', locationId: 'main',
      documentLineId: 'line-1', inventoryUnitId: 'piece', sourceId: 'document-1',
      sourceKey: 'document:1:line:1:receipt', effectiveAt: new Date('2026-08-03'),
      quantity: new Prisma.Decimal(2), totalValue: new Prisma.Decimal(14), conversionVersionId: null,
      sourceSnapshot: { kernelVersion: 4 },
    });

    expect(result).toMatchObject({ entryType: 'receipt', quantityAfter: new Prisma.Decimal(12), valueAfter: new Prisma.Decimal(64) });
    expect(String((result as { averageUnitCostAfter: Prisma.Decimal }).averageUnitCostAfter)).toBe('5.33333333');
  });

  it('records an independent cancellation as inventory consumption, not a receipt or reversal', async () => {
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('user-1');
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4InventoryLedgerEntry: {
        findFirst: jest.fn().mockResolvedValue({
          inventoryUnitId: 'piece', quantityAfter: new Prisma.Decimal(10),
          valueAfter: new Prisma.Decimal(50), averageUnitCostAfter: new Prisma.Decimal(5),
        }),
        create: jest.fn(async ({ data }: { data: unknown }) => data),
      },
    };
    const service = new OrdersV4LedgerPostingService();
    const result = await service.postRegistrationCancellation(tx as never, {
      tenantId: 'tenant-1', companyId: 'company-1', itemId: 'item-1', locationId: 'main',
      documentLineId: 'line-1', inventoryUnitId: 'piece', sourceId: 'document-1',
      sourceKey: 'document:1:line:1:cancellation', effectiveAt: new Date('2026-08-03'),
      quantity: new Prisma.Decimal(2), unitCost: new Prisma.Decimal(5), conversionVersionId: null,
      recipeVersionId: null, sourceSnapshot: { kernelVersion: 4 },
    });

    expect(result).toMatchObject({
      entryType: 'registration_cancellation',
      quantityDelta: new Prisma.Decimal(-2),
      quantityAfter: new Prisma.Decimal(8),
      valueAfter: new Prisma.Decimal(40),
    });
  });

  it('records both the counted quantity and its inventory adjustment in one stocktake operation', async () => {
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('user-1');
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4InventoryLedgerEntry: {
        findFirst: jest.fn().mockResolvedValue({
          inventoryUnitId: 'piece', quantityAfter: new Prisma.Decimal(10),
          valueAfter: new Prisma.Decimal(50), averageUnitCostAfter: new Prisma.Decimal(5),
        }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'entry-1', ...data })),
      },
      ordersV4StocktakeLine: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'stocktake-line-1', ...data })),
      },
    };
    const service = new OrdersV4LedgerPostingService();
    const result = await service.postStocktakeAdjustment(tx as never, {
      tenantId: 'tenant-1', companyId: 'company-1', itemId: 'item-1', inventoryUnitId: 'piece', locationId: 'main',
      stocktakeId: 'stocktake-1', effectiveAt: new Date('2026-08-03'), physicalQuantity: '7', stocktakeNumber: 'STK4-1',
    });

    expect(result.calculation.quantityDelta).toEqual(new Prisma.Decimal(-3));
    expect(result.entry).toMatchObject({ entryType: 'stocktake_adjustment', quantityAfter: new Prisma.Decimal(7), valueAfter: new Prisma.Decimal(35) });
    expect(tx.ordersV4StocktakeLine.create).toHaveBeenCalledTimes(1);
  });

  it('posts custody funding then purchase against one locked running balance', async () => {
    jest.spyOn(TenantContext, 'getUserId').mockReturnValue('user-1');
    const creates: Array<{ data: Record<string, unknown> }> = [];
    const tx = {
      $executeRaw: jest.fn(),
      ordersV4CustodyLedgerEntry: {
        findFirst: jest.fn().mockResolvedValue({ balanceAfter: new Prisma.Decimal(100) }),
        create: jest.fn(async (args: { data: Record<string, unknown> }) => { creates.push(args); return args.data; }),
      },
    };
    const service = new OrdersV4FundsPostingService();
    await service.postPurchase(tx as never, {
      tenantId: 'tenant-1', companyId: 'company-1', documentId: 'document-1',
      effectiveAt: new Date('2026-08-03'), purchaseAmount: new Prisma.Decimal(80), fundingAmount: new Prisma.Decimal(50),
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(creates.map((row) => [row.data.entryType, String(row.data.balanceAfter)])).toEqual([
      ['funding', '150'], ['purchase', '70'],
    ]);
  });
});
