/**
 * مفاتيح React Query — ملخصات المبيعات وقنوات البيع
 */
export const salesKeys = {
  summaries: (companyId: string, startDate?: string, endDate?: string) =>
    ['sales-summaries', companyId, startDate, endDate] as const,

  summariesPaged: (
    companyId: string,
    startDate: unknown,
    endDate: unknown,
    listPage: number,
    pageSize: number,
    debouncedQ: string,
    sortKey: string,
    sortDir: string,
    salesViewSummariesList: boolean,
    showCancelledSales: boolean,
    shift: string,
  ) =>
    [
      'sales-summaries-paged',
      companyId,
      startDate,
      endDate,
      listPage,
      pageSize,
      debouncedQ,
      sortKey,
      sortDir,
      salesViewSummariesList,
      showCancelledSales,
      shift,
    ] as const,

  channels: (companyId: string) => ['sales-channels', companyId] as const,

  summariesRoot: () => ['sales-summaries'] as const,

  summariesPagedRoot: () => ['sales-summaries-paged'] as const,

  channelsRoot: () => ['sales-channels'] as const,

  entryLast: (companyId: string) => ['sales-entry', 'last', companyId] as const,

  entryDay: (companyId: string, ymd: string) => ['sales-entry', 'day', companyId, ymd] as const,

  entryContextRoot: () => ['sales-entry'] as const,
};
