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
 * يعرض الكسر العشري فقط إذا وُجد، بحد أقصى خانة واحدة (قابل للتعيين).
 * مثال: 100 → "100" | 100.5 → "100.5" | 100.55 → "100.6"
 * @param {number|Decimal|null|undefined} n - القيمة
 * @param {number} maxDecimals - الحد الأقصى للخانات العشرية (1 افتراضي)
 */
export function fmt(n, maxDecimals = 1) {
  const raw = n instanceof Decimal ? n.toNumber() : Number(n ?? 0);
  const num = Number.isFinite(raw) ? raw : 0;
  return num.toLocaleString('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * حساب الضريبة العكسية للتنسيق والعرض.
 */
export function calcReverseVat(totalInclusive, isTaxable) {
  try {
    const { net, tax } = splitTaxFromTotal(totalInclusive, isTaxable);
    if (net.lte(0) && tax.lte(0)) return { net: '', tax: '' };
    const smartStr = (d) => {
      const v = d.toNumber();
      return v.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    };
    return { net: smartStr(net), tax: smartStr(tax) };
  } catch {
    return { net: '', tax: '' };
  }
}
