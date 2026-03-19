/**
 * Noorix — محرك الحسابات الموحد.
 * جميع العمليات المالية تتم بـ Decimal.js فقط. ممنوع استخدام Math.round أو Number في الحسابات.
 */
import Decimal from 'decimal.js';

/** نسبة الضريبة الموحدة (ZATCA / السعودية) 15% */
export const TAX_RATE = new Decimal(0.15);

/**
 * جمع مبالغ (هللات دقيقة).
 */
export function add(...amounts: (string | number | Decimal)[]): Decimal {
  return amounts.reduce<Decimal>(
    (acc, a) => acc.plus(normalize(a)),
    new Decimal(0),
  );
}

/**
 * طرح: أ - ب.
 */
export function sub(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  return normalize(a).minus(normalize(b));
}

/**
 * ضرب (مثلاً مبلغ × نسبة).
 */
export function mul(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  return normalize(a).times(normalize(b));
}

/**
 * قسمة (مثلاً إجمالي ÷ (1 + نسبة الضريبة)).
 */
export function div(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  return normalize(a).dividedBy(normalize(b));
}

/**
 * استخراج المبلغ قبل الضريبة والضريبة من الإجمالي الشامل.
 * لا استخدام لـ Math.round أو Number — النتيجة Decimal بدقة هللات.
 * @param totalInclusive الإجمالي شامل الضريبة
 * @param rate نسبة الضريبة (افتراضي 15%)
 * @returns { net, tax } كلاهما Decimal
 */
export function splitTax(
  totalInclusive: string | number | Decimal,
  rate: string | number | Decimal = TAX_RATE,
): { net: Decimal; tax: Decimal } {
  const total = normalize(totalInclusive);
  if (total.lte(0)) {
    return { net: new Decimal(0), tax: new Decimal(0) };
  }
  const r = normalize(rate);
  const divisor = new Decimal(1).plus(r);
  const net = total.dividedBy(divisor);
  const tax = total.minus(net);
  return { net, tax };
}

/**
 * تقريب إلى منزلتين عشريتين (هللات) باستخدام Decimal.round فقط — ليس Math.round.
 */
export function toHalalas(value: string | number | Decimal): Decimal {
  return normalize(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * تحويل مدخل إلى Decimal بشكل آمن.
 */
function normalize(value: string | number | Decimal): Decimal {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined || value === '') return new Decimal(0);
  return new Decimal(value);
}

/**
 * ضريبة 15% من مبلغ معين (مبلغ × 0.15).
 */
export function taxAmount(amount: string | number | Decimal): Decimal {
  return toHalalas(mul(amount, TAX_RATE));
}

/**
 * إجمالي شامل الضريبة من مبلغ صافي: net × (1 + 0.15).
 */
export function addTax(netAmount: string | number | Decimal): Decimal {
  return toHalalas(mul(netAmount, new Decimal(1).plus(TAX_RATE)));
}
