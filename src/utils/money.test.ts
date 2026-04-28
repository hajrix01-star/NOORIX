import { describe, it, expect } from 'vitest';
import { formatCompactNumber, formatMoney, formatNumber, formatPercent } from './money';

/** Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) — must not appear in formatted output */
const ARABIC_INDIC_DIGIT = /[\u0660-\u0669]/;

describe('money formatters (Latin digits)', () => {
  it('formatNumber(ar) uses ASCII digits, not Arabic-Indic', () => {
    const s = formatNumber(12345.67, 'ar', { minFractionDigits: 0, maxFractionDigits: 2 });
    expect(ARABIC_INDIC_DIGIT.test(s)).toBe(false);
    expect(s).toBe('12,345.67');
  });

  it('formatMoney(ar) uses ASCII digits', () => {
    const s = formatMoney(9999.4, 'ar');
    expect(ARABIC_INDIC_DIGIT.test(s)).toBe(false);
    expect(s).toMatch(/\d/);
  });

  it('formatPercent(ar) uses ASCII digits', () => {
    const s = formatPercent(12.34, 'ar', 1);
    expect(ARABIC_INDIC_DIGIT.test(s)).toBe(false);
    expect(s.endsWith('%')).toBe(true);
    expect(s).toMatch(/12\.3%/);
  });

  it('English lang still formats with Latin digits', () => {
    expect(ARABIC_INDIC_DIGIT.test(formatNumber(5432.1, 'en'))).toBe(false);
    expect(ARABIC_INDIC_DIGIT.test(formatMoney(1000, 'en'))).toBe(false);
    expect(ARABIC_INDIC_DIGIT.test(formatPercent(5, 'en', 1))).toBe(false);
  });

  it('formatCompactNumber is unchanged (ASCII)', () => {
    expect(formatCompactNumber(1500, 'ar')).toBe('2K');
    expect(formatCompactNumber(2_500_000, 'ar')).toBe('2.5M');
  });
});
