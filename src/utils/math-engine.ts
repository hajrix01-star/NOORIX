/**
 * math-engine — محرك الحسابات المالية المركزي.
 * جميع العمليات الحسابية باستخدام Decimal.js فقط — لا float ولا Math.round.
 */
import Decimal from 'decimal.js';

/** نسبة الضريبة الموحدة (15%) — ZATCA / السعودية */
export const TAX_RATE = 0.15;

/**
 * تقريب موحّد إلى رقمين عشريين (HALF_UP — متوافق مع ZATCA).
 * يُستخدم في كل مكان بدلاً من Math.round أو toFixed.
 * @param {string|number|Decimal} value
 * @param {number} [dp=2]
 * @returns {Decimal}
 */
export function roundAmount(value: any, dp: any = 2) {
  try {
    return new Decimal(value ?? 0).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
  } catch {
    return new Decimal(0);
  }
}

/**
 * جمع مبالغ من مصفوفة.
 * @param {Array<object>} items
 * @param {string} field - اسم الحقل (totalAmount, netAmount, balance, ...)
 * @returns {Decimal}
 */
export function sumAmounts(items: any, field: any) {
  if (!Array.isArray(items) || items.length === 0) return new Decimal(0);
  return items.reduce((acc: any, item: any) => {
    try {
      return acc.plus(new Decimal(item?.[field] ?? 0));
    } catch {
      return acc;
    }
  }, new Decimal(0));
}

/**
 * استخراج الصافي والضريبة من المبلغ الشامل.
 * @param {string|number|Decimal} totalInclusive
 * @param {boolean} [isTaxable=true]
 * @param {number} [rate=TAX_RATE]
 * @returns {{ net: Decimal, tax: Decimal }}
 */
export function splitTaxFromTotal(totalInclusive: any, isTaxable: any = true, rate: any = TAX_RATE) {
  let t;
  try {
    t = new Decimal(totalInclusive ?? 0);
  } catch {
    return { net: new Decimal(0), tax: new Decimal(0) };
  }
  if (t.lte(0)) return { net: new Decimal(0), tax: new Decimal(0) };
  if (!isTaxable) return { net: t, tax: new Decimal(0) };
  const divisor = new Decimal(1).plus(rate);
  const net = t.div(divisor);
  return { net, tax: t.minus(net) };
}

/**
 * استخراج الصافي والضريبة كأرقام مقرّبة (للحفظ في الحالة أو API).
 * يطابق الخادم: صافي مقرّب ثم ضريبة = الإجمالي − الصافي (net + tax = total).
 */
export function splitTaxFromTotalAsNumbers(totalInclusive: any, isTaxable: any = true, rate: any = TAX_RATE) {
  let gross: Decimal;
  try {
    gross = new Decimal(totalInclusive ?? 0);
  } catch {
    return { net: 0, tax: 0 };
  }
  if (gross.lte(0)) return { net: 0, tax: 0 };
  if (!isTaxable) return { net: roundAmount(gross).toNumber(), tax: 0 };

  const { net } = splitTaxFromTotal(totalInclusive, true, rate);
  const grossRounded = roundAmount(gross);
  const roundedNet = roundAmount(net);
  const roundedTax = grossRounded.minus(roundedNet);
  return { net: roundedNet.toNumber(), tax: roundedTax.toNumber() };
}

/**
 * جمع قيم كائن (مثل channelAmounts: { vaultId: amount }).
 * @param {Object} obj
 * @returns {Decimal}
 */
export function sumObjectValues(obj: Record<string, unknown> | null | undefined) {
  if (!obj || typeof obj !== 'object') return new Decimal(0);
  return Object.values(obj).reduce<Decimal>((acc: any, v: any) => {
    try {
      return acc.plus(new Decimal((v as string | number | Decimal) ?? 0));
    } catch {
      return acc;
    }
  }, new Decimal(0));
}
