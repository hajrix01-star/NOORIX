import { Prisma } from '@prisma/client';
import {
  aggregateOrdersMonthSummary,
  aggregateOrdersRangeSummary,
  aggregateOrdersRangeSummaryGroups,
} from './orders-month-summary.util';

describe('orders summary aggregation', () => {
  it('aggregates delegate and local order totals with Decimal-safe math', () => {
    expect(
      aggregateOrdersMonthSummary([
        { orderType: 'external', pettyCashAmount: new Prisma.Decimal('100.50'), totalAmount: new Prisma.Decimal('75.25') },
        { orderType: 'internal', pettyCashAmount: null, totalAmount: new Prisma.Decimal('40.10') },
        { orderType: 'transfer', pettyCashAmount: null, totalAmount: new Prisma.Decimal('30.20') },
      ]),
    ).toMatchObject({
      pettyCashTotal: '100.5',
      delegatePurchasesTotal: '75.25',
      localPurchasesTotal: '40.1',
      transferPurchasesTotal: '30.2',
      delegateBalance: '25.25',
      filteredTotal: '145.55',
    });
  });

  it('keeps cash remaining backend-owned for range summaries', () => {
    expect(
      aggregateOrdersRangeSummary(
        [
          { orderType: 'internal', pettyCashAmount: null, totalAmount: new Prisma.Decimal('40') },
          { orderType: 'external', pettyCashAmount: new Prisma.Decimal('20'), totalAmount: new Prisma.Decimal('15') },
          { orderType: 'transfer', pettyCashAmount: null, totalAmount: new Prisma.Decimal('90') },
        ],
        new Prisma.Decimal('150'),
      ),
    ).toMatchObject({
      cashSalesTotal: '150',
      cashRemaining: '110',
      transferPurchasesTotal: '90',
      filteredTotal: '145',
    });
  });

  it('aggregates grouped database totals without loading every order row', () => {
    expect(
      aggregateOrdersRangeSummaryGroups(
        [
          {
            orderType: 'external',
            _sum: {
              pettyCashAmount: new Prisma.Decimal('120'),
              totalAmount: new Prisma.Decimal('75'),
            },
          },
          {
            orderType: 'internal',
            _sum: {
              pettyCashAmount: null,
              totalAmount: new Prisma.Decimal('40'),
            },
          },
          {
            orderType: 'transfer',
            _sum: {
              pettyCashAmount: null,
              totalAmount: new Prisma.Decimal('90'),
            },
          },
        ],
        new Prisma.Decimal('150'),
      ),
    ).toEqual({
      pettyCashTotal: '120',
      delegatePurchasesTotal: '75',
      localPurchasesTotal: '40',
      transferPurchasesTotal: '90',
      delegateBalance: '45',
      cashSalesTotal: '150',
      cashRemaining: '110',
      filteredTotal: '205',
    });
  });
});
