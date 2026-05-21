/** Dashboard insights payload — derived only; does not replace ledger/VAT numbers. */

export const INSIGHTS_SCHEMA_VERSION = 1 as const;

export type InsightSeverity = 'info' | 'warning' | 'critical';

/** Basis for interpretation — do not mix without reading labels. */
export type InsightMetricBasis = 'accounting_pl' | 'operational_sales' | 'invoice_period';

export type InsightItem = {
  id: string;
  severity: InsightSeverity;
  category: string;
  metricBasis: InsightMetricBasis;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  values?: Record<string, unknown>;
};

export type DashboardInsightsLabels = {
  profitLossScope: 'accounting_ledger_pl';
  salesPackScope: 'operational_daily_sales_summaries';
  periodAnalyticsScope: 'invoice_aggregates_period';
};

export type DashboardInsightsPayload = {
  schemaVersion: typeof INSIGHTS_SCHEMA_VERSION;
  generatedAt: string;
  context: {
    companyId: string;
    year: number;
    selectedMonth: number | null;
    labels: DashboardInsightsLabels;
  };
  metrics: {
    accounting: {
      sales: string | number | null;
      purchases: string | number | null;
      expenses: string | number | null;
      grossProfit: string | number | null;
      netProfit: string | number | null;
    };
    operational: {
      periodSalesFromSummaries?: number | null;
      activeSalesDaysInMonth?: number | null;
    };
  };
  ratios: {
    purchaseToSales: number | null;
    expenseToSales: number | null;
    grossProfitMargin: number | null;
    netProfitMargin: number | null;
    /** Prior calendar month amount + change vs that month — null when selectedMonth is null or no prior month */
    trailingAvgPurchases: number | null;
    purchaseChangeRatio: number | null;
    trailingAvgExpenses: number | null;
    expenseChangeRatio: number | null;
    trailingAvgGrossProfit: number | null;
    grossProfitChangeRatio: number | null;
    trailingAvgNetProfit: number | null;
    netProfitChangeRatio: number | null;
    notes: string[];
  };
  health: {
    score: number | null;
    band: 'green' | 'amber' | 'red' | 'unknown';
    summaryAr: string;
    summaryEn: string;
  };
  insights: InsightItem[];
  opportunities: InsightItem[];
  warnings: InsightItem[];
  /** P&L sales sub-rows for the selected month (read-only presentation slice for Smart Chat). */
  salesBreakdown?: Array<{
    key: string;
    labelAr: string;
    labelEn: string;
    amountDisplay: string;
    shareOfGroupTotal: number | null;
  }>;
};
