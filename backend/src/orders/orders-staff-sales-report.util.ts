export type StaffSalesReportPeriod = {
  start: Date;
  end: Date;
};

export function buildSalesReportSince(days: number, now: Date = new Date()): Date {
  return buildSalesReportPeriodFromDays(days, now).start;
}

export function buildSalesReportPeriodFromDays(days: number, now: Date = new Date()): StaffSalesReportPeriod {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

export function buildSalesReportPeriodFromYmd(startDate: string, endDate: string): StaffSalesReportPeriod {
  return {
    start: new Date(`${startDate}T00:00:00.000Z`),
    end: new Date(`${endDate}T23:59:59.999Z`),
  };
}

function staffSaleReportDate(order: { saleDate?: Date | null; createdAt: Date }): Date {
  return order.saleDate ?? order.createdAt;
}

export function staffSaleMatchesReportPeriod(
  order: { saleDate?: Date | null; createdAt: Date },
  period: StaffSalesReportPeriod,
): boolean {
  const reportDate = staffSaleReportDate(order);
  return reportDate >= period.start && reportDate <= period.end;
}

/** @deprecated use staffSaleMatchesReportPeriod with an explicit end date. */
export function staffSaleMatchesReportWindow(
  order: { saleDate?: Date | null; createdAt: Date },
  since: Date,
): boolean {
  if (order.createdAt >= since) return true;
  if (order.saleDate != null) return order.saleDate >= since;
  return false;
}
