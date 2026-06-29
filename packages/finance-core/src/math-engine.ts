import Decimal from 'decimal.js';

export const TAX_RATE = 0.15;

export type DecimalInput = string | number | Decimal | null | undefined;

export function normalizeDecimal(value: DecimalInput): Decimal {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined || value === '') return new Decimal(0);
  return new Decimal(value);
}

export function add(...amounts: DecimalInput[]): Decimal {
  return amounts.reduce<Decimal>((acc, amount) => acc.plus(normalizeDecimal(amount)), new Decimal(0));
}

export function sub(a: DecimalInput, b: DecimalInput): Decimal {
  return normalizeDecimal(a).minus(normalizeDecimal(b));
}

export function mul(a: DecimalInput, b: DecimalInput): Decimal {
  return normalizeDecimal(a).times(normalizeDecimal(b));
}

export function div(a: DecimalInput, b: DecimalInput): Decimal {
  return normalizeDecimal(a).dividedBy(normalizeDecimal(b));
}

export function roundAmount(value: DecimalInput, dp = 2): Decimal {
  try {
    return normalizeDecimal(value).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
  } catch {
    return new Decimal(0);
  }
}

export const toHalalas = roundAmount;

export function splitTax(
  totalInclusive: DecimalInput,
  rate: DecimalInput = TAX_RATE,
): { net: Decimal; tax: Decimal } {
  const total = normalizeDecimal(totalInclusive);
  if (total.lte(0)) return { net: new Decimal(0), tax: new Decimal(0) };
  const divisor = new Decimal(1).plus(normalizeDecimal(rate));
  const net = total.dividedBy(divisor);
  return { net, tax: total.minus(net) };
}

export function splitTaxFromTotal(
  totalInclusive: DecimalInput,
  isTaxable = true,
  rate: DecimalInput = TAX_RATE,
): { net: Decimal; tax: Decimal } {
  const total = normalizeDecimal(totalInclusive);
  if (total.lte(0)) return { net: new Decimal(0), tax: new Decimal(0) };
  if (!isTaxable) return { net: total, tax: new Decimal(0) };
  return splitTax(total, rate);
}

export function splitTaxBalancedHalalas(
  totalInclusive: DecimalInput,
  rate: DecimalInput = TAX_RATE,
): { net: Decimal; tax: Decimal } {
  const gross = normalizeDecimal(totalInclusive);
  if (gross.lte(0)) return { net: new Decimal(0), tax: new Decimal(0) };
  const { net } = splitTax(gross, rate);
  const netRounded = toHalalas(net);
  return { net: netRounded, tax: gross.minus(netRounded) };
}

export function splitTaxFromTotalAsNumbers(
  totalInclusive: DecimalInput,
  isTaxable = true,
  rate: DecimalInput = TAX_RATE,
): { net: number; tax: number } {
  const gross = normalizeDecimal(totalInclusive);
  if (gross.lte(0)) return { net: 0, tax: 0 };
  if (!isTaxable) return { net: roundAmount(gross).toNumber(), tax: 0 };
  const { net } = splitTax(gross, rate);
  const grossRounded = roundAmount(gross);
  const roundedNet = roundAmount(net);
  return { net: roundedNet.toNumber(), tax: grossRounded.minus(roundedNet).toNumber() };
}

export function roundAmountAsNumber(value: DecimalInput, dp = 2): number {
  return roundAmount(value, dp).toNumber();
}

export function roundMoney(value: DecimalInput): number {
  return roundAmountAsNumber(value, 2);
}

export const roundMoney2 = roundMoney;

export function resolveVatRateDecimal(vatRatePercent?: DecimalInput): Decimal {
  if (vatRatePercent !== null && vatRatePercent !== undefined && vatRatePercent !== '') {
    const n = Number(vatRatePercent);
    if (Number.isFinite(n) && n >= 0) return new Decimal(n).div(100);
  }
  return new Decimal(TAX_RATE);
}

export function sumAmounts<T extends Record<string, unknown>>(items: T[] | null | undefined, field: keyof T): Decimal {
  if (!Array.isArray(items) || items.length === 0) return new Decimal(0);
  return items.reduce<Decimal>((acc, item) => {
    try {
      return acc.plus(normalizeDecimal(item?.[field] as DecimalInput));
    } catch {
      return acc;
    }
  }, new Decimal(0));
}

export function sumObjectValues(obj: Record<string, unknown> | null | undefined): Decimal {
  if (!obj || typeof obj !== 'object') return new Decimal(0);
  return Object.values(obj).reduce<Decimal>((acc, value) => {
    try {
      return acc.plus(normalizeDecimal(value as DecimalInput));
    } catch {
      return acc;
    }
  }, new Decimal(0));
}

export function taxAmount(amount: DecimalInput): Decimal {
  return toHalalas(mul(amount, TAX_RATE));
}

export function addTax(netAmount: DecimalInput): Decimal {
  return toHalalas(mul(netAmount, new Decimal(1).plus(TAX_RATE)));
}
