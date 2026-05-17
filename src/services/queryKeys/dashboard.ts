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
  overview: (
    companyId: string,
    year: number,
    yearStart: string,
    yearEnd: string,
    periodStart: string,
    periodEnd: string,
    dailyStart: string | null,
    dailyEnd: string | null,
    monthStart: string | null,
    monthEnd: string | null,
    selectedMonth: number | null,
    includeCancelledSales: boolean,
  ) =>
    [
      'dashboard-overview',
      companyId,
      year,
      yearStart,
      yearEnd,
      periodStart,
      periodEnd,
      dailyStart,
      dailyEnd,
      monthStart,
      monthEnd,
      selectedMonth,
      includeCancelledSales,
    ] as const,

  overviewRoot: () => ['dashboard-overview'] as const,

  /** بيانات التقويم (أهداف + أيام خاصة + ملاحظات) */
  calendar: (companyId: string, year: number, month: number) =>
    ['dashboard-calendar', companyId, year, month] as const,

  calendarRoot: () => ['dashboard-calendar'] as const,
};
