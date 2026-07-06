export type InvoiceNumericValue = number | string | null | undefined;

export function toInvoiceFiniteNumber(value: unknown, fallback = 0) {
  if (value == null || value === '') return fallback;
  const numericValue =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function hasInvoiceNumericValue(value: unknown) {
  return value != null && value !== '' && Number.isFinite(toInvoiceFiniteNumber(value, Number.NaN));
}
