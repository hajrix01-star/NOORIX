const EPSILON = 0.000001;

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) || Math.abs(value) < EPSILON ? 0 : value;
}

export function safePercent(numerator: unknown, denominator: unknown): number | null {
  const n = finiteNumber(numerator);
  const d = finiteNumber(denominator);
  if (n == null || d == null || Math.abs(d) < EPSILON) return null;
  return normalizeZero((n / d) * 100);
}

export function percentOfSales(value: unknown, sales: unknown): number | null {
  return safePercent(value, sales);
}

export function profitMargin(netProfit: unknown, sales: unknown): number | null {
  return safePercent(netProfit, sales);
}

export function grossMargin(grossProfit: unknown, sales: unknown): number | null {
  return safePercent(grossProfit, sales);
}

export function purchaseRatio(purchases: unknown, sales: unknown): number | null {
  const pct = safePercent(purchases, sales);
  return pct == null ? null : Math.abs(pct);
}

export function expenseRatio(expenses: unknown, sales: unknown): number | null {
  const pct = safePercent(expenses, sales);
  return pct == null ? null : Math.abs(pct);
}

export function dailyAverage(total: unknown, days: unknown): number | null {
  const n = finiteNumber(total);
  const d = finiteNumber(days);
  if (n == null || d == null || d <= 0) return null;
  return normalizeZero(n / d);
}

export function formatSignedPercent(value: unknown): string {
  const n = finiteNumber(value);
  if (n == null) return '—';
  const rounded = normalizeZero(Math.round(n * 10) / 10);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

export function formatPercentLabel(value: unknown): string {
  const formatted = formatSignedPercent(value);
  return formatted === '—' ? formatted : `${formatted}%`;
}
