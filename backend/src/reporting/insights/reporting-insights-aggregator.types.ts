import type { DashboardInsightsPayload, InsightItem } from './insights.types';
import type { ExpenseInsightsPayload } from './expenses/expense-insights.types';
import type { PurchaseSupplierInsightsPayload } from './purchases/purchase-supplier-insights.types';

export const EXTENDED_REPORTING_INSIGHTS_SCHEMA_VERSION = 1 as const;

export type InsightWarningSource = 'dashboard' | 'purchases' | 'expenses';

/** Merged warning with origin; originals on child payloads remain unmodified. */
export type CombinedInsightWarning = InsightItem & {
  source: InsightWarningSource;
};

export type ExtendedReportingInsightsPayload = {
  schemaVersion: typeof EXTENDED_REPORTING_INSIGHTS_SCHEMA_VERSION;
  generatedAt: string;
  context: {
    companyId: string;
    year: number;
    selectedMonth: number | null;
    periodStart: string;
    periodEnd: string;
    labels: {
      dashboard: string;
      purchases: string;
      expenses: string;
    };
  };
  dashboardInsights: DashboardInsightsPayload;
  purchaseSupplierInsights: PurchaseSupplierInsightsPayload;
  expenseInsights: ExpenseInsightsPayload;
  warnings: CombinedInsightWarning[];
};
