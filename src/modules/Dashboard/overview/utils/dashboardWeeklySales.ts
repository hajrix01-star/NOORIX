/**
 * متوسط مبيعات أسبوعي ضمني من إجمالي الشهر: نفس الإيراد الشهري موزّع على أيام الشهر ثم ×7.
 */
import { lastDayOfMonth } from './dashboardOverviewDateUtils';

export function avgWeeklySalesFromMonthTotal(monthTotal: number, year: number, month: number): number {
  const d = lastDayOfMonth(year, month);
  if (!d || !Number.isFinite(monthTotal) || monthTotal <= 0) return 0;
  return (monthTotal * 7) / d;
}

export function pctChangeVsBaseline(current: number, baseline: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return null;
  if (Math.abs(baseline) < 1e-9) return null;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}
