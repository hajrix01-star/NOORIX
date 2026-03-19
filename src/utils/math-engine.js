/**
 * math-engine — محرك الحسابات المالية المركزي.
 * جميع العمليات الحسابية باستخدام Decimal.js فقط — لا float ولا Math.round.
 */
import Decimal from 'decimal.js';

/** نسبة الضريبة الموحدة (15%) — ZATCA / السعودية */
export const TAX_RATE = 0.15;

/**
 * جمع مبالغ من مصفوفة.
 * @param {Array<object>} items
 * @param {string} field - اسم الحقل (totalAmount, netAmount, balance, ...)
 * @returns {Decimal}
 */
export function sumAmounts(items, field) {
  if (!Array.isArray(items) || items.length === 0) return new Decimal(0);
  return items.reduce((acc, item) => acc.plus(new Decimal(item?.[field] ?? 0)), new Decimal(0));
}

/**
 * استخراج الصافي والضريبة من المبلغ الشامل.
 * @param {string|number|Decimal} totalInclusive
 * @param {boolean} [isTaxable=true]
 * @param {number} [rate=TAX_RATE]
 * @returns {{ net: Decimal, tax: Decimal }}
 */
export function splitTaxFromTotal(totalInclusive, isTaxable = true, rate = TAX_RATE) {
  const t = new Decimal(totalInclusive || 0);
  if (t.lte(0)) return { net: new Decimal(0), tax: new Decimal(0) };
  if (!isTaxable) return { net: t, tax: new Decimal(0) };
  const divisor = new Decimal(1).plus(rate);
  const net = t.div(divisor);
  return { net, tax: t.minus(net) };
}

/**
 * استخراج الصافي والضريبة كأرقام (للحفظ في الحالة أو API).
 */
export function splitTaxFromTotalAsNumbers(totalInclusive, isTaxable = true, rate = TAX_RATE) {
  const { net, tax } = splitTaxFromTotal(totalInclusive, isTaxable, rate);
  return { net: net.toNumber(), tax: tax.toNumber() };
}

/**
 * جمع قيم كائن (مثل channelAmounts: { vaultId: amount }).
 * @param {Object} obj
 * @returns {Decimal}
 */
export function sumObjectValues(obj) {
  if (!obj || typeof obj !== 'object') return new Decimal(0);
  return Object.values(obj).reduce((acc, v) => acc.plus(new Decimal(v ?? 0)), new Decimal(0));
}
