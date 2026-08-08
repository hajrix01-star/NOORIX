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

export type DashboardSalesMetricDailyTotal = {
  transactionDate: string;
  totalAmount: number;
  customerCount: number;
};

export type DashboardSalesMetricWeekdayAverage = {
  dow: number;
  totalSales: number;
  calendarDays: number;
  avgDaily: number | null;
};

export type DashboardSalesShiftBucket = {
  amount: number;
  customers: number;
  sharePct: number | null;
};

export type DashboardSalesShiftTotals = Record<'all' | 'morning' | 'evening', DashboardSalesShiftBucket>;

export type DashboardSalesMetricChannel = {
  periodKey: string;
  vaultId: string;
  nameAr: string;
  nameEn?: string | null;
  type?: string | null;
  amount: string | number;
};

export type DashboardChannelBreakdownMetricRow = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  amount: number;
  sharePct: number | null;
};

export type DashboardSalesMetricAverage = {
  total: number;
  customerCount: number;
  calendarDays: number;
  revenueAvgDaily: number | null;
  customerAvgDaily: number | null;
  basketAvg: number | null;
};

export type DashboardSalesMetricWeeklyRow = {
  weekIndex: number;
  dayStart: number;
  dayEnd: number;
  totalSales: number;
  avgDailyInWeek: number;
  calendarDaysInSlice: number;
};

export type DashboardSalesMetricWeeklyComparisonRow = {
  weekIndex: number;
  dayStart: number;
  dayEnd: number;
  avgDailyCurrent: number | null;
  avgDailyBaseline: number;
  deltaPct: number | null;
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

export type DashboardAppSalesMetricMonthPoint = {
  year: number;
  month: number;
  periodKey: string;
  total: number;
  app: number;
  appPercent: number;
};

export type DashboardAppSalesMetricChannelRow = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  periodAmount: number;
  periodPercent: number;
  months: Record<string, { amount: number; percent: number }>;
};

export type DashboardAppSalesMetricModel = {
  monthSeries: DashboardAppSalesMetricMonthPoint[];
  channels: DashboardAppSalesMetricChannelRow[];
  periodTotal: number;
  periodApp: number;
  periodAppPercent: number;
  hasData: boolean;
};

export type DashboardSalesPackMetrics = {
  yearDaily: DashboardSalesMetricDay[];
  yearChannels: DashboardSalesMetricChannel[];
  dailyDaily: DashboardSalesMetricDay[];
  dailyTotals?: DashboardSalesMetricDailyTotal[];
  dailyChannels: DashboardSalesMetricChannel[];
  channelBreakdown?: DashboardChannelBreakdownMetricRow[];
  monthDaily: DashboardSalesMetricDay[];
  monthAverage?: DashboardSalesMetricAverage;
  weekdayAverages?: DashboardSalesMetricWeekdayAverage[];
  dailyWeekly?: DashboardSalesMetricWeeklyRow[];
  dailyWeeklyComparison?: DashboardSalesMetricWeeklyComparisonRow[];
  shiftTotals?: DashboardSalesShiftTotals;
  yearMonthlyDailyAverages?: DashboardSalesMetricMonthlyAverageRow[];
  appSales?: DashboardAppSalesMetricModel;
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
  totalsByKind?: Record<string, { totalAmount?: string | number | null; invoiceCount?: number | null }>;
  topSuppliers?: Array<{
    supplierId?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    totalAmount?: string | number | null;
    invoiceCount?: number | null;
    sharePct?: number | null;
  }>;
  purchaseCategoryBreakdown?: Array<{
    id?: string | null;
    categoryId?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    amount?: string | number | null;
    sharePct?: number | null;
  }>;
  purchaseCategoryTotal?: unknown;
  fixedExpenseTotal?: string | number | null;
  fixedExpenseInvoiceCount?: number | null;
  recurringCostCategoryBreakdown?: Array<{
    id?: string | null;
    categoryId?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    amount?: string | number | null;
    sharePct?: number | null;
  }>;
  otherExpenseCategoryBreakdown?: Array<{
    id?: string | null;
    categoryId?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    amount?: string | number | null;
    sharePct?: number | null;
  }>;
  otherExpenseTotal?: string | number | null;
} | null;

export type DashboardTimelineMetricRow = {
  label: string;
  sales: number;
  purchases: number;
  expenses: number;
  customers: number;
  avgInvoice: number;
};

export type DashboardKpiCardMetric = {
  key: string;
  value: number;
  pct: number | null;
  tone: 'positive' | 'negative' | 'neutral' | 'cost';
};

export type DashboardOverviewPresentation = {
  kpiCards?: DashboardKpiCardMetric[];
  timeline?: {
    monthly?: DashboardTimelineMetricRow[];
    daily?: DashboardTimelineMetricRow[];
  };
  weeklyComparison?: DashboardSalesMetricWeeklyComparisonRow[];
  previousMonthAverage?: DashboardSalesMetricAverage | null;
  basketAvgDeltaPct?: number | null;
};

export type DashboardVaultActivityRow = {
  vaultId: string;
  nameAr: string;
  nameEn?: string | null;
  type: string;
  isArchived: boolean;
  inflow: string | number;
  outflow: string | number;
  periodResult: string | number;
  inflowSharePct: number | null;
  transferIn: string | number;
  transferOut: string | number;
};

export type DashboardVaultActivity = {
  totalInflow: string | number;
  totalOutflow: string | number;
  periodResult: string | number;
  transferVolume: string | number;
  rows: DashboardVaultActivityRow[];
};

export type DashboardOperationalOverview = {
  sales: string | number;
  recurringCosts: {
    amount: string | number;
    recordCount: number;
    shareOfSalesPct: number | null;
    categories: NonNullable<NonNullable<DashboardPeriodDataLike>['recurringCostCategoryBreakdown']>;
  };
  otherExpenses: {
    amount: string | number;
    shareOfSalesPct: number | null;
    categories: NonNullable<NonNullable<DashboardPeriodDataLike>['otherExpenseCategoryBreakdown']>;
  };
  purchases: {
    amount: string | number;
    shareOfSalesPct: number | null;
    categories: NonNullable<NonNullable<DashboardPeriodDataLike>['purchaseCategoryBreakdown']>;
  };
  operatingCosts: {
    amount: string | number;
    shareOfSalesPct: number | null;
  };
};

export type DashboardOverviewData = {
  report: PlReportLike | null;
  salesPack: DashboardSalesPackData;
  insights: DashboardInsightsPayload | null;
  periodData: DashboardPeriodDataLike;
  vaultActivity: DashboardVaultActivity;
  operationalOverview: DashboardOperationalOverview;
  presentation?: DashboardOverviewPresentation;
};
