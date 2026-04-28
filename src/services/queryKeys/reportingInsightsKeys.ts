/**
 * مفاتيح React Query — رؤى التقارير / لوحة التحكم (Reporting insights)
 */
export type ReportingInsightsDashboardKeyInput = {
  companyId: string;
  year: number;
  yearStart: string;
  yearEnd: string;
  dailyStart: string | null;
  dailyEnd: string | null;
  monthStart: string | null;
  monthEnd: string | null;
  periodStart: string;
  periodEnd: string;
  selectedMonth: number | null;
  includeCancelledSales: boolean;
};

export const reportingInsightsKeys = {
  dashboard: (p: ReportingInsightsDashboardKeyInput) =>
    [
      'reporting-insights',
      'dashboard',
      p.companyId,
      p.year,
      p.yearStart,
      p.yearEnd,
      p.dailyStart,
      p.dailyEnd,
      p.monthStart,
      p.monthEnd,
      p.periodStart,
      p.periodEnd,
      p.selectedMonth,
      p.includeCancelledSales,
    ] as const,

  root: () => ['reporting-insights'] as const,
};
