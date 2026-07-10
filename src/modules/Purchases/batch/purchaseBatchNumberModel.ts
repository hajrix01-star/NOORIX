export function toPurchaseBatchFiniteNumber(value: unknown, fallback = 0) {
  if (value == null || value === '') return fallback;
  const numericValue =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function toPurchaseBatchPositiveNumber(value: unknown): number | null {
  const numericValue = toPurchaseBatchFiniteNumber(value, Number.NaN);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}
