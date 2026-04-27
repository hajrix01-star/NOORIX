import Decimal from 'decimal.js';

export const PL_MONTH_COUNT = 12;

export function plDec(value: Decimal.Value): Decimal {
  return new Decimal(value || 0);
}

export function plZeroMonths(): Decimal[] {
  return Array.from({ length: PL_MONTH_COUNT }, () => new Decimal(0));
}

export function plSumMonths(months: Decimal[]): Decimal {
  return months.reduce((sum, month) => sum.plus(month), new Decimal(0));
}

export function plPercentOfSales(value: Decimal, salesAmount: Decimal): Decimal {
  if (!salesAmount || salesAmount.eq(0)) return new Decimal(0);
  return value.div(salesAmount).mul(100);
}
