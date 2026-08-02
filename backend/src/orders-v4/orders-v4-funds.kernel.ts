import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

function money(value: Prisma.Decimal.Value, label: string): Prisma.Decimal {
  try {
    const parsed = new Prisma.Decimal(value);
    if (!parsed.isFinite()) throw new Error('not finite');
    return parsed.toDecimalPlaces(6);
  } catch {
    throw new BadRequestException(`${label} غير صالح`);
  }
}

export type OrdersV4FundsMovement = {
  amountDelta: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
};

export function calculateOrdersV4CustodyFunding(
  balance: Prisma.Decimal.Value,
  amount: Prisma.Decimal.Value,
): OrdersV4FundsMovement {
  const current = money(balance, 'رصيد العهدة');
  const funding = money(amount, 'مبلغ إضافة العهدة');
  if (funding.lte(0)) throw new BadRequestException('مبلغ إضافة العهدة يجب أن يكون أكبر من صفر');
  return { amountDelta: funding, balanceAfter: current.plus(funding).toDecimalPlaces(6) };
}

export function calculateOrdersV4CustodyPurchase(
  balance: Prisma.Decimal.Value,
  amount: Prisma.Decimal.Value,
): OrdersV4FundsMovement {
  const current = money(balance, 'رصيد العهدة');
  const purchase = money(amount, 'مبلغ الشراء من العهدة');
  if (purchase.lt(0)) throw new BadRequestException('مبلغ الشراء من العهدة لا يمكن أن يكون سالبًا');
  return { amountDelta: purchase.negated(), balanceAfter: current.minus(purchase).toDecimalPlaces(6) };
}

export function calculateOrdersV4FundsReversal(
  balance: Prisma.Decimal.Value,
  originalDelta: Prisma.Decimal.Value,
): OrdersV4FundsMovement {
  const current = money(balance, 'رصيد العهدة');
  const amountDelta = money(originalDelta, 'حركة العهدة الأصلية').negated();
  return { amountDelta, balanceAfter: current.plus(amountDelta).toDecimalPlaces(6) };
}

export function calculateOrdersV4CashAvailable(
  importedCash: Prisma.Decimal.Value,
  usedCash: Prisma.Decimal.Value,
): Prisma.Decimal {
  return money(importedCash, 'النقد المستورد').minus(money(usedCash, 'النقد المستخدم')).toDecimalPlaces(6);
}

export function calculateOrdersV4FundsBalance(
  amountDeltas: readonly Prisma.Decimal.Value[],
): Prisma.Decimal {
  return amountDeltas.reduce<Prisma.Decimal>(
    (total, amount) => total.plus(money(amount, 'حركة العهدة')),
    new Prisma.Decimal(0),
  ).toDecimalPlaces(6);
}
