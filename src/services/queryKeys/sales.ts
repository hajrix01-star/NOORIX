/**
 * مفاتيح React Query — ملخصات المبيعات وقنوات البيع
 */
export const salesKeys = {
  summaries: (companyId: string, startDate?: string, endDate?: string) =>
    ['sales-summaries', companyId, startDate, endDate] as const,

  channels: (companyId: string) => ['sales-channels', companyId] as const,
};
