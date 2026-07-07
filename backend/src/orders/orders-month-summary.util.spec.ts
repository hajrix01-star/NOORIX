import { Prisma } from '@prisma/client';
import { aggregateOrdersMonthSummary, aggregateOrdersRangeSummary } from './orders-month-summary.util';

describe('orders summary aggregation', () => {
  it('aggregates delegate and local order totals with Decimal-safe math', () => {
    expect(
      aggregateOrdersMonthSummary([
        { orderType: 'external', pettyCashAmount: new Prisma.Decimal('100.50'), totalAmount: new Prisma.Decimal('75.25') },
        { orderType: 'internal', pettyCashAmount: null, totalAmount: new Prisma.Decimal('40.10') },
      ]),
    ).toMatchObject({
      pettyCashTotal: '100.5',
      delegatePurchasesTotal: '75.25',
      localPurchasesTotal: '40.1',
      delegateBalance: '25.25',
      filteredTotal: '115.35',
    });
  });

  it('keeps cash remaining backend-owned for range summaries', () => {
    expect(
      aggregateOrdersRangeSummary(
        [
          { orderType: 'internal', pettyCashAmount: null, totalAmount: new Prisma.Decimal('40') },
          { orderType: 'external', pettyCashAmount: new Prisma.Decimal('20'), totalAmount: new Prisma.Decimal('15') },
        ],
        new Prisma.Decimal('150'),
      ),
    ).toMatchObject({
      cashSalesTotal: '150',
      cashRemaining: '110',
      filteredTotal: '55',
    });
  });
});
