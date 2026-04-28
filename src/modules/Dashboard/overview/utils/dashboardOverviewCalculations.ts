/**
 * استخراج قيم من تقرير P&L — نفس منطق Dashboard overview السابق (عرض فقط).
 */
export type PlReportLike = {
  cards?: Record<string, string | number | undefined>;
  summaryRows?: Array<{ key?: string; months?: Array<string | number | undefined> }>;
  groups?: Array<{ key?: string; months?: Array<string | number | undefined> }>;
};

export function getCardValue(
  report: PlReportLike | null | undefined,
  key: string,
  selectedMonth: number | null,
): string {
  if (!report) return '0';
  if (!selectedMonth) return String(report.cards?.[key] ?? '0');
  if (key === 'grossProfit' || key === 'netProfit') {
    return String(
      report.summaryRows?.find((r) => r.key === key)?.months?.[selectedMonth - 1] ?? '0',
    );
  }
  return String(
    report.groups?.find((r) => r.key === key)?.months?.[selectedMonth - 1] ?? '0',
  );
}

export function getSectionPercentOfSales(
  report: PlReportLike | null | undefined,
  key: string,
  selectedMonth: number | null,
): string | null {
  if (!report || key === 'sales') return null;
  const sales = Number(getCardValue(report, 'sales', selectedMonth) || 0);
  if (!sales || sales < 0.0000001) return null;
  return ((Number(getCardValue(report, key, selectedMonth) || 0) / sales) * 100).toFixed(1);
}

export function getPctStringForCard(
  report: PlReportLike | null | undefined,
  key: string,
  selectedMonth: number | null,
): string | null {
  if (key === 'sales') {
    const sales = Number(getCardValue(report, 'sales', selectedMonth) || 0);
    return sales > 0 ? (100).toFixed(1) : null;
  }
  return getSectionPercentOfSales(report, key, selectedMonth);
}

export function getMonthlyData(
  report: PlReportLike | null | undefined,
  key: string,
): Array<string | number | undefined> {
  if (!report) return [];
  if (key === 'grossProfit' || key === 'netProfit') {
    return report.summaryRows?.find((r) => r.key === key)?.months ?? [];
  }
  return report.groups?.find((r) => r.key === key)?.months ?? [];
}
