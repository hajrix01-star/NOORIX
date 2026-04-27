/**
 * مفتاح React Query موحّد وقابل للتعقب — بلا تعديل عشوائي للتواريخ.
 */
export type AnalyticsStudioFilterState = {
  startDate: string;
  endDate: string;
  /** all = بدون companyId في الـ API؛ one = شركة محددة */
  companyScope: 'all' | 'one';
  /** عند companyScope === 'one' */
  companyId: string;
};

export function normalizeAnalyticsStudioFilters(f: AnalyticsStudioFilterState) {
  return {
    startDate: f.startDate,
    endDate: f.endDate,
    companyKey: f.companyScope === 'all' ? 'all' : f.companyId,
  };
}
