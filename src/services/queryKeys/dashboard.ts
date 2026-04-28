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
};
