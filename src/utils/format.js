/**
 * format — تنسيق الأرقام المالية (عرض فقط).
 * الحسابات في math-engine.js
 */
import Decimal from 'decimal.js';
import { splitTaxFromTotal } from './math-engine';

/** إعادة التصدير للتوافق مع الاستيرادات الحالية */
export { sumAmounts } from './math-engine';

/**
 * تنسيق رقم مالي — أرقام إنجليزية مع فواصل الآلاف.
 * يتعامل مع null/undefined/NaN بأمان بإرجاع '0.0'.
 * @param {number|Decimal|null|undefined} n - القيمة
 * @param {number} decimals - عدد الخانات العشرية (1 افتراضي، 2 للمبالغ الدقيقة)
 */
export function fmt(n, decimals = 1) {
  const raw = n instanceof Decimal ? n.toNumber() : Number(n ?? 0);
  const num = Number.isFinite(raw) ? raw : 0;
  return num.toLocaleString('en', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * تنسيق مبلغ مالي مع رمز الريال السعودي.
 * رمز ﷼ يظهر بعد الرقم (صحيح للـ RTL وعرف السوق السعودي).
 * @param {number|Decimal|null|undefined} n
 * @param {number} decimals
 * @returns {string} مثال: "1,250.0 ﷼"
 */
export function fmtSAR(n, decimals = 1) {
  return `${fmt(n, decimals)} ﷼`;
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
