import { Prisma } from '@prisma/client';
import { OrdersV4ReportsService } from './orders-v4-reports.service';

describe('OrdersV4ReportsService', () => {
  function decimal(value: Prisma.Decimal.Value) {
    return new Prisma.Decimal(value);
  }

  it('reports registration operational cost independently from a zero selling total', async () => {
    const prisma = {
      ordersV4Document: {
        findMany: jest.fn().mockResolvedValue([
          { documentType: 'registration', paymentMethod: null, totalAmount: decimal(0), operationalCost: decimal(4.75) },
          { documentType: 'purchase', paymentMethod: 'cash', totalAmount: decimal(110), operationalCost: decimal(110) },
        ]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ total: decimal(536) }]),
      ordersV4CustodyLedgerEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const service = new OrdersV4ReportsService(prisma as never);
    const summary = await service.summary('company-1', '2026-08-01', '2026-08-31');

    expect(summary.registrationTotal.toString()).toBe('4.75');
    expect(summary.purchaseTotal.toString()).toBe('110');
    expect(summary.cashUsed.toString()).toBe('110');
    expect(summary.cashAvailable.toString()).toBe('426');
  });

  it('nets custody purchases and funding against their linked reversal entries', async () => {
    const prisma = {
      ordersV4Document: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([{ total: decimal(0) }]),
      ordersV4CustodyLedgerEntry: {
        findMany: jest.fn().mockResolvedValue([
          { entryType: 'funding', amountDelta: decimal(1000), reversalOf: null },
          { entryType: 'funding', amountDelta: decimal(200), reversalOf: null },
          { entryType: 'reversal', amountDelta: decimal(-200), reversalOf: { entryType: 'funding' } },
          { entryType: 'purchase', amountDelta: decimal(-100), reversalOf: null },
          { entryType: 'reversal', amountDelta: decimal(100), reversalOf: { entryType: 'purchase' } },
          { entryType: 'purchase', amountDelta: decimal(-30), reversalOf: null },
        ]),
      },
    };

    const service = new OrdersV4ReportsService(prisma as never);
    const summary = await service.summary('company-1', '2026-08-01', '2026-08-31');

    expect(summary.custodyFunded.toString()).toBe('1000');
    expect(summary.custodySpent.toString()).toBe('30');
    expect(summary.custodyBalance.toString()).toBe('970');
  });

  it('starts the custody balance from zero at the beginning of every selected period', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { entryType: 'funding', amountDelta: decimal(500), reversalOf: null },
      { entryType: 'purchase', amountDelta: decimal(-125), reversalOf: null },
    ]);
    const prisma = {
      ordersV4Document: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([{ total: decimal(0) }]),
      ordersV4CustodyLedgerEntry: { findMany },
    };

    const service = new OrdersV4ReportsService(prisma as never);
    const summary = await service.summary('company-1', '2026-08-01', '2026-08-31');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: 'company-1', effectiveAt: expect.any(Object) }),
    }));
    expect(summary.custodyBalance.toString()).toBe('375');
  });

  it('keeps registration cancellation quantities signed in the item report', async () => {
    const prisma = {
      ordersV4DocumentLine: {
        findMany: jest.fn().mockResolvedValue([{
          itemId: 'item-1',
          documentId: 'document-1',
          baseQuantity: decimal(-3),
          baseUnitId: 'piece',
          operationalCost: decimal(-12),
          item: {
            id: 'item-1', nameAr: 'معسل', kernelUnitId: 'piece', inventoryUnitId: 'piece',
            category: { nameAr: 'مواد' },
            inventoryUnit: { id: 'piece', nameAr: 'حبة' },
            conversionVersions: [],
          },
        }]),
      },
      ordersV4Unit: {
        findMany: jest.fn().mockResolvedValue([{ id: 'piece', code: 'piece', dimension: 'count', canonicalFactor: decimal(1) }]),
      },
    };

    const service = new OrdersV4ReportsService(prisma as never);
    const rows = await service.itemsReport('company-1', 'registration', '2026-08-01', '2026-08-31');

    expect(rows).toHaveLength(1);
    expect(rows[0].baseQuantity.toString()).toBe('-3');
    expect(rows[0].totalAmount.toString()).toBe('-12');
  });

  it('scopes a line search to matching lines and recalculates document totals from the same snapshot', async () => {
    const line = (id: string, name: string, amount: number) => ({
      id,
      itemId: id,
      itemNameSnapshot: name,
      lineTotal: decimal(amount),
      operationalCost: decimal(amount),
      cancellationReasons: [],
      cancellationNote: null,
      item: { id, nameAr: name, nameEn: null, sku: null, category: { id: 'cat', nameAr: 'مواد', nameEn: null } },
      inputUnit: { id: 'piece', nameAr: 'حبة' },
      baseUnit: { id: 'piece', nameAr: 'حبة' },
      priceUnit: { id: 'piece', nameAr: 'حبة' },
    });
    const prisma = {
      ordersV4Document: { findMany: jest.fn().mockResolvedValue([{
        id: 'document-1', documentNumber: 'REG-1', documentType: 'registration', documentDate: new Date('2026-08-02'),
        status: 'received', createdByUserId: null, notes: null, section: { nameAr: 'بار', nameEn: null },
        location: { id: 'main' }, subtotal: decimal(0), totalAmount: decimal(0), operationalCost: decimal(30),
        lines: [line('sugar', 'سكر', 10), line('tea', 'شاي', 20)],
      }]) },
      ordersV4Section: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4Category: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4Item: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4Unit: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new OrdersV4ReportsService(prisma as never);
    const report = await service.activityReport('company-1', 'registration', '2026-08-01', '2026-08-31', { search: 'سكر' });

    expect(report.documents).toHaveLength(1);
    expect(report.documents[0].lines.map((entry) => entry.itemId)).toEqual(['sugar']);
    expect(report.documents[0].operationalCost.toString()).toBe('10');
  });

  it('builds the internal report from one period document snapshot without nested report queries', async () => {
    const document = {
      id: 'registration-1',
      documentNumber: 'REG-1',
      documentType: 'registration',
      registrationEntryType: 'issue',
      documentDate: new Date('2026-08-02T00:00:00.000Z'),
      status: 'received',
      sectionId: 'bar',
      createdByUserId: 'user-1',
      operationalCost: decimal(12),
      section: { id: 'bar', nameAr: 'بار' },
      location: { id: 'main', nameAr: 'الرئيسي' },
      lines: [{
        id: 'line-1',
        itemId: 'item-1',
        itemNameSnapshot: 'معسل',
        baseQuantity: decimal(3),
        operationalCost: decimal(12),
        item: { category: { nameAr: 'مواد' } },
        inputUnit: { nameAr: 'علبة' },
        baseUnit: { nameAr: 'حبة' },
        priceUnit: { nameAr: 'علبة' },
      }],
    };
    const documentFindMany = jest.fn()
      .mockResolvedValueOnce([document])
      .mockResolvedValueOnce([{ sectionId: 'bar', documentDate: document.documentDate }]);
    const prisma = {
      ordersV4Document: { findMany: documentFindMany },
      ordersV4Section: { findMany: jest.fn().mockResolvedValue([{ id: 'bar', code: 'bar', nameAr: 'بار', nameEn: null }]) },
      ordersV4Category: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4Item: { findMany: jest.fn().mockResolvedValue([]) },
      ordersV4Unit: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'user-1', nameAr: 'عامل', nameEn: null, email: 'staff@example.com' }]) },
    };

    const service = new OrdersV4ReportsService(prisma as never);
    const report = await service.salesReport(
      'company-1',
      '2026-08-01T00:00:00+03:00',
      '2026-08-03T23:59:59+03:00',
    );

    expect(documentFindMany).toHaveBeenCalledTimes(2);
    expect(report.summary.count).toBe(1);
    expect(report.summary.totalAmount.toString()).toBe('12');
    expect(report.byItem[0]).toMatchObject({ nameAr: 'معسل', documentCount: 1, inventoryUnit: 'حبة' });
    expect(report.byItem[0].baseQuantity.toString()).toBe('3');
    expect(report.registrationCoverage).toMatchObject({ startDate: '2026-08-01', endDate: '2026-08-03' });
  });
});
