/**
 * نسبة ضريبة القيمة المضافة من إعدادات الشركة — مصدر واحد للواجهة.
 */
import { TAX_RATE } from '@noorix/finance-core';

export const DEFAULT_VAT_RATE_PERCENT = 15;

/** نسبة عشرية (0.15) من حقل vatRatePercent في الشركة. */
export function vatRateDecimalFromPercent(vatRatePercent?: number | string | null): number {
  if (vatRatePercent != null && vatRatePercent !== '') {
    const n = Number(vatRatePercent);
    if (Number.isFinite(n) && n >= 0) return n / 100;
  }
  return TAX_RATE;
}

function getCompanyVatRatePercent(company: unknown): number | string | null | undefined {
  if (!company || typeof company !== 'object') return undefined;
  return (company as { vatRatePercent?: number | string | null }).vatRatePercent;
}

export function vatRateDecimalFromCompany(company?: unknown): number {
  return vatRateDecimalFromPercent(getCompanyVatRatePercent(company));
}

export function vatRatePercentFromCompany(company?: unknown): number {
  const vatRatePercent = getCompanyVatRatePercent(company);
  if (vatRatePercent != null && Number.isFinite(Number(vatRatePercent))) {
    return Number(vatRatePercent);
  }
  return DEFAULT_VAT_RATE_PERCENT;
}
