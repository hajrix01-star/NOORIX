
/**
 * Formats a fractional ratio (e.g. 0.355) for insight copy: percentage with max one decimal,
 * no trailing ".0" for whole numbers. Display-only; does not alter underlying numeric inputs.
 */
export function formatInsightPercentFraction(fraction: number): string {
  const pct = fraction * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (!Number.isFinite(rounded)) return '0';
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

export function parseAmount(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}
