export function toDashboardNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) return fallback;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function toDashboardOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = toDashboardNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toDashboardNonNegativeNumber(value: unknown): number | null {
  const parsed = toDashboardOptionalNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}
