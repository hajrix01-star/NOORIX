import type { PlReportLike } from '../../../modules/Dashboard/overview/utils/dashboardOverviewCalculations';

export type DashboardNamedEntity = {
  id?: string | null;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

export type DashboardSalesChannel = {
  amount?: string | number | null;
  vault?: DashboardNamedEntity;
};

export type DashboardSalesSummary = {
  id?: string | null;
  companyId?: string | null;
  summaryNumber?: string | null;
  transactionDate?: string | null;
  totalAmount?: string | number | null;
  customerCount?: number | null;
  channels?: DashboardSalesChannel[];
};

export type DashboardSalesMetricDay = {
  transactionDate: string;
  shift?: 'morning' | 'evening' | 'all' | string | null;
  totalAmount: string | number;
  customerCount: number;
};

export type DashboardSalesMetricChannel = {
  periodKey: string;
  vaultId: string;
  nameAr: string;
  nameEn?: string | null;
  type?: string | null;
  amount: string | number;
};

export type DashboardSalesMetricAverage = {
  total: number;
  customerCount: number;
  calendarDays: number;
  revenueAvgDaily: number | null;
  customerAvgDaily: number | null;
};

export type DashboardSalesMetricWeeklyRow = {
  weekIndex: number;
  dayStart: number;
  dayEnd: number;
  totalSales: number;
  avgDailyInWeek: number;
  calendarDaysInSlice: number;
};

export type DashboardSalesMetricMonthlyAverageRow = {
  periodKey: string;
  month: number;
  totalSales: number | null;
  avgDaily: number | null;
  calendarDays: number;
  deltaPctVsPrev: number | null;
  tone: 'up' | 'down' | 'neutral';
  isCurrentMonth: boolean;
};

export type DashboardSalesPackMetrics = {
  yearDaily: DashboardSalesMetricDay[];
  yearChannels: DashboardSalesMetricChannel[];
  dailyDaily: DashboardSalesMetricDay[];
  dailyChannels: DashboardSalesMetricChannel[];
  monthDaily: DashboardSalesMetricDay[];
  monthAverage?: DashboardSalesMetricAverage;
  dailyWeekly?: DashboardSalesMetricWeeklyRow[];
  yearMonthlyDailyAverages?: DashboardSalesMetricMonthlyAverageRow[];
};

export type DashboardSalesPackData = {
  yearSummaries: DashboardSalesSummary[];
  dailySummaries: DashboardSalesSummary[];
  monthSummaries: DashboardSalesSummary[];
  metrics?: DashboardSalesPackMetrics;
};

export type DashboardCalendarTargets = {
  overall: number | null;
  byDow: Record<string, number>;
};

export type DashboardSpecialDay = {
  id: string;
  name: string;
  fromDate: string;
  toDate: string;
  color: string;
};

export type DashboardCalendarDayNotes = Record<string, string>;

export type DashboardCalendarDataResult = {
  targets: DashboardCalendarTargets;
  specialDays: DashboardSpecialDay[];
  dayNotes: DashboardCalendarDayNotes;
  isDefaultTargets: boolean;
  hasMonthOverride: boolean;
  defaultTargets: DashboardCalendarTargets;
};

export type DashboardCalendarDay = {
  day: number;
  dateStr: string;
  dow: number;
  amount: number;
  dayTarget: number | null;
  special: DashboardSpecialDay | null;
};

export type DashboardInsightsLabels = {
  profitLossScope: 'accounting_ledger_pl';
  salesPackScope: 'operational_daily_sales_summaries';
  periodAnalyticsScope: 'invoice_aggregates_period';
};

export type DashboardInsightSeverity = 'info' | 'warning' | 'critical';
export type DashboardInsightMetricBasis = 'accounting_pl' | 'operational_sales' | 'invoice_period';

export type DashboardInsightItem = {
  id: string;
  severity: DashboardInsightSeverity;
  category: string;
  metricBasis: DashboardInsightMetricBasis;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  values?: Record<string, unknown>;
};

export type DashboardInsightsPayload = {
  schemaVersion: 1;
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
  insights: DashboardInsightItem[];
  opportunities: DashboardInsightItem[];
  warnings: DashboardInsightItem[];
  salesBreakdown?: Array<{
    key: string;
    labelAr: string;
    labelEn: string;
    amountDisplay: string;
    shareOfGroupTotal: number | null;
  }>;
};

export type DashboardPeriodDataLike = {
  topSuppliers?: Array<Record<string, unknown>>;
  purchaseCategoryBreakdown?: Array<Record<string, unknown>>;
  purchaseCategoryTotal?: unknown;
} | null;

export type DashboardOverviewData = {
  report: PlReportLike | null;
  salesPack: DashboardSalesPackData;
  insights: DashboardInsightsPayload | null;
  periodData: DashboardPeriodDataLike;
};
