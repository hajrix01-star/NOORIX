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
      ordersV4CustodyLedgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
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
});
