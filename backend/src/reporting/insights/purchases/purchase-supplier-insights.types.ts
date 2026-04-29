import type { InsightItem } from '../insights.types';

export const PURCHASE_SUPPLIER_INSIGHTS_SCHEMA_VERSION = 1 as const;

export type PurchaseSupplierInsightsLabels = {
  purchaseCategoriesScope: 'invoice_period_purchase_only';
  supplierClassificationScope: 'invoice_period_supplier_counts';
  purchaseCategorySpikeScope: 'accounting_ledger_pl_purchase_categories';
};

export type PurchaseSupplierInsightsPayload = {
  schemaVersion: typeof PURCHASE_SUPPLIER_INSIGHTS_SCHEMA_VERSION;
  generatedAt: string;
  context: {
    companyId: string;
    year: number;
    selectedMonth: number | null;
    periodStart: string;
    periodEnd: string;
    labels: PurchaseSupplierInsightsLabels;
  };
  supplierInsights: InsightItem[];
  purchaseInsights: InsightItem[];
  warnings: InsightItem[];
};
