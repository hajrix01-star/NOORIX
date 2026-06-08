import { Prisma } from '@prisma/client';
import {
  resolveStaffItemUnitPrice,
  staffItemLineAmount,
  staffOrdersQty,
  staffOrdersTotal,
  staffSaleAvgPerOperation,
  staffSaleAvgPerOrder,
} from './orders-staff-amount.util';

describe('orders-staff-amount.util', () => {
  const orders = [
    {
      items: [
        { quantity: 2, unitPrice: 10 },
        { quantity: 1, unitPrice: 5 },
      ],
    },
    {
      items: [{ quantity: 3, unitPrice: 4 }],
    },
  ];

  it('sums line amounts', () => {
    expect(Number(staffItemLineAmount({ quantity: 2, unitPrice: 10 }))).toBe(20);
    expect(Number(staffOrdersTotal(orders))).toBe(37);
    expect(staffOrdersQty(orders)).toBe(6);
  });

  it('falls back to product catalog price for legacy rows with unitPrice 0', () => {
    const item = {
      quantity: 2,
      unitPrice: 0,
      product: { lastPrice: 15, variants: [] },
    };
    expect(Number(resolveStaffItemUnitPrice(item))).toBe(15);
    expect(Number(staffItemLineAmount(item))).toBe(30);
  });

  it('computes averages', () => {
    const total = staffOrdersTotal(orders);
    expect(Number(staffSaleAvgPerOrder(total, 6))).toBeCloseTo(37 / 6);
    expect(Number(staffSaleAvgPerOperation(total, 2))).toBeCloseTo(18.5);
  });

  it('handles zero divisors', () => {
    const zero = new Prisma.Decimal(0);
    expect(Number(staffSaleAvgPerOrder(zero, 0))).toBe(0);
    expect(Number(staffSaleAvgPerOperation(zero, 0))).toBe(0);
  });
});
