/**
 * format — تنسيق الأرقام المالية (عرض فقط).
 * الحسابات في math-engine.ts
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
type FormatNumberInput = unknown;

export function fmt(n: FormatNumberInput, maxDecimals: number = 0) {
  const raw = n instanceof Decimal ? n.toNumber() : Number(n ?? 0);
  const num = Number.isFinite(raw) ? raw : 0;
  return num.toLocaleString('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * تنسيق مبالغ الضريبة في واجهات الإفصاح (Hajri + تقرير الضريبة) — خانة عشرية كحد أقصى.
 */
export function fmtTax(n: FormatNumberInput) {
  const raw = n instanceof Decimal ? n.toNumber() : Number(n ?? 0);
  const num = Number.isFinite(raw) ? raw : 0;
  return num.toLocaleString('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * حساب الضريبة العكسية للتنسيق والعرض.
 */
export function calcReverseVat(totalInclusive: FormatNumberInput, isTaxable: boolean) {
  try {
    const amount =
      totalInclusive instanceof Decimal ||
      typeof totalInclusive === 'number' ||
      typeof totalInclusive === 'string'
        ? totalInclusive
        : 0;
    const { net, tax } = splitTaxFromTotal(amount, isTaxable);
    if (net.lte(0) && tax.lte(0)) return { net: '', tax: '' };
    const smartStr = (d: Decimal) => {
      const v = d.toNumber();
      return v.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    };
    return { net: smartStr(net), tax: smartStr(tax) };
  } catch {
    return { net: '', tax: '' };
  }
}
