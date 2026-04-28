/**
 * تنسيق مركزي للمال والأرقام والنسب — عرض فقط (لا حسابات).
 * القيم المالية تُعرض أرقامًا إنجليزية مع فاصلات؛ اللاحقة SR تُضاف في JSX عبر nx-sar حسب القواعد.
 */

export type MoneyLang = 'ar' | 'en' | string;

function toFinite(n: unknown): number {
  const raw = Number(n ?? 0);
  return Number.isFinite(raw) ? raw : 0;
}

function localeForLang(lang?: MoneyLang): string {
  if (lang === 'ar') return 'ar-SA';
  return 'en';
}

/**
 * تنسيق مبلغ (أرقام فقط) — يُزوَّج عادة مع <span className="nx-sar">SR</span>
 */
export function formatMoney(value: unknown, lang?: MoneyLang): string {
  return formatNumber(value, lang, { maxFractionDigits: 1, minFractionDigits: 0 });
}

/**
 * تنسيق رقم عام — فواصل الآلاف، كسور اختيارية
 */
export function formatNumber(
  value: unknown,
  lang?: MoneyLang,
  options?: { minFractionDigits?: number; maxFractionDigits?: number },
): string {
  const n = toFinite(value);
  const min = options?.minFractionDigits ?? 0;
  const max = options?.maxFractionDigits ?? 1;
  return n.toLocaleString(localeForLang(lang), {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
}

/**
 * تنسيق نسبة — رقم خام (مثلاً 12.3 يعني 12.3%)
 */
export function formatPercent(value: unknown, lang?: MoneyLang, fractionDigits = 1): string {
  const n = toFinite(value);
  return `${n.toLocaleString(localeForLang(lang), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
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
