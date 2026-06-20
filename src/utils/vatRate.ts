/**
 * نسبة ضريبة القيمة المضافة من إعدادات الشركة — مصدر واحد للواجهة.
 */
import { TAX_RATE } from './math-engine';

export const DEFAULT_VAT_RATE_PERCENT = 15;

/** نسبة عشرية (0.15) من حقل vatRatePercent في الشركة. */
export function vatRateDecimalFromPercent(vatRatePercent?: number | string | null): number {
  if (vatRatePercent != null && vatRatePercent !== '') {
    const n = Number(vatRatePercent);
    if (Number.isFinite(n) && n >= 0) return n / 100;
  }
  return TAX_RATE;
}

export function vatRateDecimalFromCompany(company?: { vatRatePercent?: number | null } | null): number {
  return vatRateDecimalFromPercent(company?.vatRatePercent);
}

export function vatRatePercentFromCompany(company?: { vatRatePercent?: number | null } | null): number {
  if (company?.vatRatePercent != null && Number.isFinite(Number(company.vatRatePercent))) {
    return Number(company.vatRatePercent);
  }
  return DEFAULT_VAT_RATE_PERCENT;
}
