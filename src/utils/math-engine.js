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
export function roundAmount(value, dp = 2) {
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
export function sumAmounts(items, field) {
  if (!Array.isArray(items) || items.length === 0) return new Decimal(0);
  return items.reduce((acc, item) => {
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
export function splitTaxFromTotal(totalInclusive, isTaxable = true, rate = TAX_RATE) {
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
 * النتائج مقرّبة إلى رقمين عشريين (HALF_UP) لضمان: net + tax = total.
 */
export function splitTaxFromTotalAsNumbers(totalInclusive, isTaxable = true, rate = TAX_RATE) {
  const { net, tax } = splitTaxFromTotal(totalInclusive, isTaxable, rate);
  const roundedNet = roundAmount(net).toNumber();
  const roundedTax = roundAmount(tax).toNumber();
  return { net: roundedNet, tax: roundedTax };
}

/**
 * جمع قيم كائن (مثل channelAmounts: { vaultId: amount }).
 * @param {Object} obj
 * @returns {Decimal}
 */
export function sumObjectValues(obj) {
  if (!obj || typeof obj !== 'object') return new Decimal(0);
  return Object.values(obj).reduce((acc, v) => {
    try {
      return acc.plus(new Decimal(v ?? 0));
    } catch {
      return acc;
    }
  }, new Decimal(0));
}
