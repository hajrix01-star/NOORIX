import { Prisma } from '@prisma/client';
import {
  calculateOrdersV4CashAvailable,
  calculateOrdersV4CustodyFunding,
  calculateOrdersV4CustodyPurchase,
  calculateOrdersV4FundsReversal,
  calculateOrdersV4FundsBalance,
} from './orders-v4-funds.kernel';

describe('Orders V4 funds kernel', () => {
  it('owns funding, purchase and reversal arithmetic including negative custody', () => {
    const funding = calculateOrdersV4CustodyFunding(100, 50);
    expect(funding.balanceAfter.toString()).toBe('150');

    const purchase = calculateOrdersV4CustodyPurchase(funding.balanceAfter, 200);
    expect(purchase.amountDelta.toString()).toBe('-200');
    expect(purchase.balanceAfter.toString()).toBe('-50');

    const reversal = calculateOrdersV4FundsReversal(purchase.balanceAfter, purchase.amountDelta);
    expect(reversal.balanceAfter.toString()).toBe('150');
  });

  it('calculates imported cash availability centrally', () => {
    expect(calculateOrdersV4CashAvailable(new Prisma.Decimal(500), 125).toString()).toBe('375');
    expect(calculateOrdersV4FundsBalance([1000, -100, 70]).toString()).toBe('970');
  });
});
