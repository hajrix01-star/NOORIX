import type { SalesShiftValue } from '../../../Sales/constants/salesShift';
import { resolveSalesSummaryShift } from '../../../Sales/constants/salesShift';

export type SalesShiftPeriodTotals = Record<
  SalesShiftValue,
  { amount: number; customers: number }
>;

const empty = () => ({ amount: 0, customers: 0 });

/** إجمالي مبيعات وعملاء الشهر/الفترة حسب الشفت (من ملخصات المبيعات) */
export function computeSalesShiftPeriodTotals(
  summaries: Array<{
    shift?: unknown;
    notes?: unknown;
    totalAmount?: string | number | null;
    customerCount?: number | null;
  }> | null | undefined,
): SalesShiftPeriodTotals {
  const out: SalesShiftPeriodTotals = {
    all: empty(),
    morning: empty(),
    evening: empty(),
  };
  for (const s of summaries || []) {
    const shift = resolveSalesSummaryShift(s);
    const bucket = out[shift];
    bucket.amount += Number(s.totalAmount || 0);
    bucket.customers += Number(s.customerCount || 0);
  }
  return out;
}

/** مجموع مبالغ كل الشفتات في الفترة (أساس حساب النسبة) */
export function salesShiftPeriodGrandTotal(totals: SalesShiftPeriodTotals): number {
  return totals.morning.amount + totals.evening.amount + totals.all.amount;
}

/** نسبة شفت من إجمالي مبيعات الفترة (0–100)، أو null إن لم يُحسب */
export function salesShiftSharePercent(amount: number, grandTotal: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!Number.isFinite(grandTotal) || grandTotal <= 0) return null;
  return (amount / grandTotal) * 100;
}

/** عرض النسبة — خانة عشرية واحدة كحد أقصى */
export function formatSalesShiftSharePercent(percent: number): string {
  if (!Number.isFinite(percent)) return '0';
  const rounded = Math.round(percent * 10) / 10;
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}
