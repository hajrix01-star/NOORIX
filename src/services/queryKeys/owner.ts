/**
 * مفاتيح React Query — مسار المالك (لوحة المالك / تقارير مرتبطة)
 */
export const ownerKeys = {
  reports: (companyId: string, year: number) =>
    ['reports', 'general-profit-loss', 'owner', companyId, year] as const,

  dailySales: (companyId: string, year: number, month: number | null) =>
    ['owner-daily-sales', companyId, year, month] as const,

  dailySalesRoot: () => ['owner-daily-sales'] as const,

  /** نظرة عامة موحّدة — P&L + مبيعات يومية لكل الشركات في طلب واحد */
  overview: (companyIds: string[], year: number, month: number | null) =>
    ['owner-overview', companyIds.slice().sort().join(','), year, month] as const,

  overviewRoot: () => ['owner-overview'] as const,
};
