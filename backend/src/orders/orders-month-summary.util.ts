import { Prisma } from '@prisma/client';

type OrderRow = { orderType: string; pettyCashAmount: Prisma.Decimal | null; totalAmount: Prisma.Decimal };

export function aggregateOrdersMonthSummary(orders: OrderRow[]) {
  let pettyCashTotal = new Prisma.Decimal(0);
  let delegatePurchasesTotal = new Prisma.Decimal(0);
  let localPurchasesTotal = new Prisma.Decimal(0);
  for (const o of orders) {
    if (o.orderType === 'external') {
      pettyCashTotal = pettyCashTotal.plus(o.pettyCashAmount ?? 0);
      delegatePurchasesTotal = delegatePurchasesTotal.plus(o.totalAmount);
    } else {
      localPurchasesTotal = localPurchasesTotal.plus(o.totalAmount);
    }
  }
  return {
    pettyCashTotal: pettyCashTotal.toString(),
    delegatePurchasesTotal: delegatePurchasesTotal.toString(),
    localPurchasesTotal: localPurchasesTotal.toString(),
    delegateBalance: pettyCashTotal.minus(delegatePurchasesTotal).toString(),
  };
}
