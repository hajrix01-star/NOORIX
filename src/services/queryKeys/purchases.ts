import type { PurchaseBatchSummariesQueryInput } from '../domains/apiEndpoints/purchase-batch-query';

/**
 * مفاتيح React Query — المشتريات / دفعات
 */
export const purchaseKeys = {
  batchSummaries: (query: PurchaseBatchSummariesQueryInput) =>
    ['purchase-batch-summaries', query.companyId, query.startDate, query.endDate, query.q, query.lang] as const,

  batchSummariesRoot: () => ['purchase-batch-summaries'] as const,

  debts: (companyId: string, query: Record<string, unknown>) =>
    ['purchase-debts', companyId, query] as const,

  debtsRoot: () => ['purchase-debts'] as const,
};
