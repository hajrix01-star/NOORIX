/**
 * نافذة تقرير مبيعات الموظفين — بداية UTC منتصف الليل لتطابق saleDate (DATE).
 */
export function buildSalesReportSince(days: number, now: Date = new Date()): Date {
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);
  return since;
}

/** هل سجل مبيعات يقع ضمن نافذة التقرير؟ */
export function staffSaleMatchesReportWindow(
  order: { saleDate?: Date | null; createdAt: Date },
  since: Date,
): boolean {
  if (order.saleDate != null) return order.saleDate >= since;
  return order.createdAt >= since;
}
