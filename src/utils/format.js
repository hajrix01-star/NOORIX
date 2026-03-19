/**
 * format — تنسيق الأرقام المالية (عرض فقط).
 * الحسابات في math-engine.js
 */
import Decimal from 'decimal.js';
import { splitTaxFromTotal } from './math-engine';

/** إعادة التصدير للتوافق مع الاستيرادات الحالية */
export { sumAmounts } from './math-engine';

/**
 * تنسيق رقم مالي — أرقام إنجليزية.
 * @param {number|Decimal} n - القيمة
 * @param {number} decimals - عدد الخانات (1 افتراضي، 2 للمبالغ)
 */
export function fmt(n, decimals = 1) {
  const num = n instanceof Decimal ? n.toNumber() : Number(n || 0);
  return num.toLocaleString('en', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** تنسيق مالي موحد — خانتان عشريتان (0.00) لاصطفاف عمودي دقيق */
export function fmtFinancial(n) {
  return fmt(n, 2);
}

/**
 * حساب الضريبة العكسية للتنسيق والعرض.
 */
export function calcReverseVat(totalInclusive, isTaxable) {
  try {
    const { net, tax } = splitTaxFromTotal(totalInclusive, isTaxable);
    if (net.lte(0) && tax.lte(0)) return { net: '', tax: '' };
    return { net: net.toFixed(1), tax: tax.toFixed(1) };
  } catch {
    return { net: '', tax: '' };
  }
}
