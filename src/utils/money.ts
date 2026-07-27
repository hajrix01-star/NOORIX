/**
 * تنسيق مركزي للمال والأرقام والنسب — عرض فقط (لا حسابات).
 * القيم المالية تُعرض أرقامًا إنجليزية مع فاصلات؛ اللاحقة SR تُضاف في JSX عبر nx-sar حسب القواعد.
 *
 * Product rule: numbers are always displayed with Latin digits (0-9), even in Arabic UI.
 */

export type MoneyLang = 'ar' | 'en' | string;

function toFinite(n: unknown): number {
  const raw = Number(n ?? 0);
  return Number.isFinite(raw) ? raw : 0;
}

/**
 * Latin-digit numeric string for display. `lang` is accepted at call sites for API
 * compatibility; digit shape does not follow UI language.
 */
function formatWithLatinDigits(n: number, minimumFractionDigits: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
    numberingSystem: 'latn',
  }).format(n);
}

/**
 * تنسيق مبلغ (أرقام فقط) — يُزوَّج عادة مع <span className="nx-sar">SR</span>
 */
export function formatMoney(value: unknown, lang?: MoneyLang): string {
  return formatNumber(value, lang, { maxFractionDigits: 0, minFractionDigits: 0 });
}

/**
 * تنسيق رقم عام — فواصل الآلاف، كسور اختيارية
 */
export function formatNumber(
  value: unknown,
  lang?: MoneyLang,
  options?: { minFractionDigits?: number; maxFractionDigits?: number },
): string {
  void lang;
  const n = toFinite(value);
  const min = options?.minFractionDigits ?? 0;
  const max = options?.maxFractionDigits ?? 1;
  return formatWithLatinDigits(n, min, max);
}

/**
 * تنسيق نسبة — رقم خام (مثلاً 12.3 يعني 12.3%)
 */
export function formatPercent(value: unknown, lang?: MoneyLang, fractionDigits = 1): string {
  void lang;
  const n = toFinite(value);
  return `${formatWithLatinDigits(n, fractionDigits, fractionDigits)}%`;
}

/**
 * أرقام مختصرة للمحاور والجداول الكثيفة (K / M) — نفس منطق لوحة المالك السابقة
 */
export function formatCompactNumber(value: unknown, _lang?: MoneyLang): string {
  const n = toFinite(value);
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(Math.round(n));
}
