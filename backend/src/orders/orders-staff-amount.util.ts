import { Prisma } from '@prisma/client';

export function staffItemLineAmount(item: {
  quantity?: Prisma.Decimal | number | string | null;
  unitPrice?: Prisma.Decimal | number | string | null;
}): Prisma.Decimal {
  const q = new Prisma.Decimal(item.quantity || 0);
  const p = new Prisma.Decimal(item.unitPrice ?? 0);
  return q.times(p);
}

export function staffOrdersQty(orders: { items?: { quantity?: Prisma.Decimal | number | string | null }[] }[]): number {
  let qty = new Prisma.Decimal(0);
  for (const order of orders) {
    for (const it of order.items || []) {
      qty = qty.plus(new Prisma.Decimal(it.quantity || 0));
    }
  }
  return Number(qty);
}

export function staffOrdersTotal(orders: {
  items?: { quantity?: Prisma.Decimal | number | string | null; unitPrice?: Prisma.Decimal | number | string | null }[];
}[]): Prisma.Decimal {
  let total = new Prisma.Decimal(0);
  for (const order of orders) {
    for (const it of order.items || []) {
      total = total.plus(staffItemLineAmount(it));
    }
  }
  return total;
}

/** إجمالي المبالغ ÷ عدد العمليات */
export function staffSaleAvgPerOperation(totalAmount: Prisma.Decimal, operationCount: number): Prisma.Decimal {
  const count = Number(operationCount) || 0;
  return count > 0 ? totalAmount.div(count) : new Prisma.Decimal(0);
}

/** عملية واحدة: إجمالي المبلغ ÷ إجمالي الكميات */
export function staffSaleAvgPerOrder(totalAmount: Prisma.Decimal, totalQty: number): Prisma.Decimal {
  const qty = Number(totalQty) || 0;
  return qty > 0 ? totalAmount.div(qty) : new Prisma.Decimal(0);
}
