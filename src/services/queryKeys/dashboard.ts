import type { DashboardPeriodQueryKeyInput } from '../domains/apiEndpoints/dashboard-period-query';

/**
 * مفاتيح React Query — لوحة التحكم (Dashboard)
 * لا تغيّر ترتيب أو ثوابت المصفوفات دون تحديث queryInvalidation إن لزم.
 */
export const dashboardKeys = {
  /** حزمة ملخصات المبيعات — يطابق invalidation prefix ['sales-dashboard-pack'] */
  salesPack: (
    companyId: string,
    yearStart: string,
    yearEnd: string,
    dailyStart: string | null,
    dailyEnd: string | null,
    monthStart: string | null,
    monthEnd: string | null,
  ) =>
    ['sales-dashboard-pack', companyId, yearStart, yearEnd, dailyStart, dailyEnd, monthStart, monthEnd] as const,

  salesPackRoot: () => ['sales-dashboard-pack'] as const,

  /** نظرة عامة موحّدة — P&L + Sales Pack + Insights + Period Analytics في طلب واحد */
  overview: (p: DashboardPeriodQueryKeyInput) =>
    [
      'dashboard-overview',
      p.companyId,
      p.year,
      p.yearStart,
      p.yearEnd,
      p.periodStart,
      p.periodEnd,
      p.dailyStart,
      p.dailyEnd,
      p.monthStart,
      p.monthEnd,
      p.selectedMonth,
      p.includeCancelledSales,
    ] as const,

  overviewRoot: () => ['dashboard-overview'] as const,

  /** بيانات التقويم (أهداف + أيام خاصة + ملاحظات) */
  calendar: (companyId: string, year: number, month: number) =>
    ['dashboard-calendar', companyId, year, month] as const,

  calendarRoot: () => ['dashboard-calendar'] as const,
};
