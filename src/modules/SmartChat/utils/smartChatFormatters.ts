/** تنسيق أرقام للمخططات المصغّرة في المحادثة — عرض فقط */

export function formatMiniChartTooltipValue(value: unknown, isAr: boolean): string {
  return `${Number(value).toLocaleString('en')} ${isAr ? 'ر.س' : 'SAR'}`;
}

export function formatMiniChartYAxisTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
}
