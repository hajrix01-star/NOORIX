/**
 * مفاتيح React Query — المشتريات / دفعات
 */
export const purchaseKeys = {
  batchSummaries: (
    companyId: string,
    startDate: unknown,
    endDate: unknown,
    batchQ: string,
    lang: string,
  ) => ['purchase-batch-summaries', companyId, startDate, endDate, batchQ, lang] as const,
};
