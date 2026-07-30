import { Prisma } from '@prisma/client';

type OrderRow = { orderType: string; pettyCashAmount: Prisma.Decimal | null; totalAmount: Prisma.Decimal };
type OrderSummaryGroup = {
  orderType: string;
  _sum: {
    pettyCashAmount: Prisma.Decimal | null;
    totalAmount: Prisma.Decimal | null;
  };
};

function buildOrdersRangeSummary(
  pettyCashTotal: Prisma.Decimal,
  delegatePurchasesTotal: Prisma.Decimal,
  localPurchasesTotal: Prisma.Decimal,
  transferPurchasesTotal: Prisma.Decimal,
  filteredTotal: Prisma.Decimal,
  cashSalesTotalInput?: Prisma.Decimal.Value,
) {
  const cashSalesTotal = new Prisma.Decimal(cashSalesTotalInput ?? 0);
  return {
    pettyCashTotal: pettyCashTotal.toString(),
    delegatePurchasesTotal: delegatePurchasesTotal.toString(),
    localPurchasesTotal: localPurchasesTotal.toString(),
    transferPurchasesTotal: transferPurchasesTotal.toString(),
    delegateBalance: pettyCashTotal.minus(delegatePurchasesTotal).toString(),
    cashSalesTotal: cashSalesTotal.toString(),
    cashRemaining: cashSalesTotal.minus(localPurchasesTotal).toString(),
    filteredTotal: filteredTotal.toString(),
  };
}

export function aggregateOrdersMonthSummary(orders: OrderRow[]) {
  return aggregateOrdersRangeSummary(orders);
}

export function aggregateOrdersRangeSummary(orders: OrderRow[], cashSalesTotalInput?: Prisma.Decimal.Value) {
  let pettyCashTotal = new Prisma.Decimal(0);
  let delegatePurchasesTotal = new Prisma.Decimal(0);
  let localPurchasesTotal = new Prisma.Decimal(0);
  let transferPurchasesTotal = new Prisma.Decimal(0);
  let filteredTotal = new Prisma.Decimal(0);
  for (const o of orders) {
    filteredTotal = filteredTotal.plus(o.totalAmount);
    if (o.orderType === 'external') {
      pettyCashTotal = pettyCashTotal.plus(o.pettyCashAmount ?? 0);
      delegatePurchasesTotal = delegatePurchasesTotal.plus(o.totalAmount);
    } else if (o.orderType === 'transfer') {
      transferPurchasesTotal = transferPurchasesTotal.plus(o.totalAmount);
    } else {
      localPurchasesTotal = localPurchasesTotal.plus(o.totalAmount);
    }
  }
  return buildOrdersRangeSummary(
    pettyCashTotal,
    delegatePurchasesTotal,
    localPurchasesTotal,
    transferPurchasesTotal,
    filteredTotal,
    cashSalesTotalInput,
  );
}

export function aggregateOrdersRangeSummaryGroups(
  groups: OrderSummaryGroup[],
  cashSalesTotalInput?: Prisma.Decimal.Value,
) {
  let pettyCashTotal = new Prisma.Decimal(0);
  let delegatePurchasesTotal = new Prisma.Decimal(0);
  let localPurchasesTotal = new Prisma.Decimal(0);
  let transferPurchasesTotal = new Prisma.Decimal(0);
  let filteredTotal = new Prisma.Decimal(0);

  for (const group of groups) {
    const totalAmount = group._sum.totalAmount ?? new Prisma.Decimal(0);
    filteredTotal = filteredTotal.plus(totalAmount);
    if (group.orderType === 'external') {
      pettyCashTotal = pettyCashTotal.plus(group._sum.pettyCashAmount ?? 0);
      delegatePurchasesTotal = delegatePurchasesTotal.plus(totalAmount);
    } else if (group.orderType === 'transfer') {
      transferPurchasesTotal = transferPurchasesTotal.plus(totalAmount);
    } else {
      localPurchasesTotal = localPurchasesTotal.plus(totalAmount);
    }
  }

  return buildOrdersRangeSummary(
    pettyCashTotal,
    delegatePurchasesTotal,
    localPurchasesTotal,
    transferPurchasesTotal,
    filteredTotal,
    cashSalesTotalInput,
  );
}
