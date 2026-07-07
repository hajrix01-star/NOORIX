import { Prisma } from '@prisma/client';

type OrderRow = { orderType: string; pettyCashAmount: Prisma.Decimal | null; totalAmount: Prisma.Decimal };

export function aggregateOrdersMonthSummary(orders: OrderRow[]) {
  return aggregateOrdersRangeSummary(orders);
}

export function aggregateOrdersRangeSummary(orders: OrderRow[], cashSalesTotalInput?: Prisma.Decimal.Value) {
  let pettyCashTotal = new Prisma.Decimal(0);
  let delegatePurchasesTotal = new Prisma.Decimal(0);
  let localPurchasesTotal = new Prisma.Decimal(0);
  let filteredTotal = new Prisma.Decimal(0);
  for (const o of orders) {
    filteredTotal = filteredTotal.plus(o.totalAmount);
    if (o.orderType === 'external') {
      pettyCashTotal = pettyCashTotal.plus(o.pettyCashAmount ?? 0);
      delegatePurchasesTotal = delegatePurchasesTotal.plus(o.totalAmount);
    } else {
      localPurchasesTotal = localPurchasesTotal.plus(o.totalAmount);
    }
  }
  const cashSalesTotal = new Prisma.Decimal(cashSalesTotalInput ?? 0);
  return {
    pettyCashTotal: pettyCashTotal.toString(),
    delegatePurchasesTotal: delegatePurchasesTotal.toString(),
    localPurchasesTotal: localPurchasesTotal.toString(),
    delegateBalance: pettyCashTotal.minus(delegatePurchasesTotal).toString(),
    cashSalesTotal: cashSalesTotal.toString(),
    cashRemaining: cashSalesTotal.minus(localPurchasesTotal).toString(),
    filteredTotal: filteredTotal.toString(),
  };
}
