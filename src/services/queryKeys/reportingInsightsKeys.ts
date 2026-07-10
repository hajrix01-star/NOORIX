import type { DashboardPeriodQueryKeyInput } from '../domains/apiEndpoints/dashboard-period-query';

/**
 * مفاتيح React Query — رؤى التقارير / لوحة التحكم (Reporting insights)
 */
export type ReportingInsightsDashboardKeyInput = DashboardPeriodQueryKeyInput;

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
