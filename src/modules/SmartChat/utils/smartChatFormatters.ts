/** تنسيق أرقام للمخططات المصغّرة في المحادثة — عرض فقط */
import { fmt } from '../../../utils/format';

export function formatMiniChartTooltipValue(value: unknown, isAr: boolean): string {
  return `${fmt(value, 0)} ${isAr ? 'ر.س' : 'SAR'}`;
}

export function formatMiniChartYAxisTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
}
