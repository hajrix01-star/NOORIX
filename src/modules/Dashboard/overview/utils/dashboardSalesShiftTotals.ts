import type { SalesShiftValue } from '../../../Sales/constants/salesShift';
import { parseSalesShiftValue } from '../../../Sales/constants/salesShift';

export type SalesShiftPeriodTotals = Record<
  SalesShiftValue,
  { amount: number; customers: number }
>;

const empty = () => ({ amount: 0, customers: 0 });

/** إجمالي مبيعات وعملاء الشهر/الفترة حسب الشفت (من ملخصات المبيعات) */
export function computeSalesShiftPeriodTotals(
  summaries: Array<{ shift?: unknown; totalAmount?: string | number | null; customerCount?: number | null }> | null | undefined,
): SalesShiftPeriodTotals {
  const out: SalesShiftPeriodTotals = {
    all: empty(),
    morning: empty(),
    evening: empty(),
  };
  for (const s of summaries || []) {
    const shift = parseSalesShiftValue(s.shift, 'all');
    const bucket = out[shift];
    bucket.amount += Number(s.totalAmount || 0);
    bucket.customers += Number(s.customerCount || 0);
  }
  return out;
}
