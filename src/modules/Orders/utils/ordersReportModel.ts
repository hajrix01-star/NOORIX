import type { OrderItemsReportRow } from '../../../types/api';

export function numberValue(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function computeItemsReportDisplayTotals(rows: OrderItemsReportRow[]) {
  return rows.reduce(
    (totals, row) => ({
      quantity: totals.quantity + numberValue(row.quantity),
      amount: totals.amount + numberValue(row.amount),
    }),
    { quantity: 0, amount: 0 },
  );
}

export function sortItemsReportByOrderCount(rows: OrderItemsReportRow[]): OrderItemsReportRow[] {
  return [...rows].sort((a, b) => Number(b.orderCount ?? 0) - Number(a.orderCount ?? 0));
}

export function sliceItemsReportByMode(
  rows: OrderItemsReportRow[],
  mode: string,
  count: number,
): OrderItemsReportRow[] {
  if (mode === 'all') return rows;
  const sorted = sortItemsReportByOrderCount(rows);
  if (mode === 'top') return sorted.slice(0, count);
  return sorted.slice(-count).reverse();
}
