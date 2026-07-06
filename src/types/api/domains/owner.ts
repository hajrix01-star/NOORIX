export type OwnerOverviewMetric = 'sales' | 'purchases' | 'expenses' | 'netProfit';

export type OwnerOverviewCompany = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
};

export type OwnerOverviewKpi = {
  key: OwnerOverviewMetric;
  total: number;
  percentOfSales: number | null;
  monthlyValues: number[];
};

export type OwnerOverviewCompanyRow = {
  companyId: string;
  nameAr: string;
  nameEn?: string | null;
  sales: number;
  purchases: number;
  expenses: number;
  netProfit: number;
  purchasesToSalesPct: number | null;
  expensesToSalesPct: number | null;
  netProfitMarginPct: number | null;
};

export type OwnerOverviewMonthlyBucket = {
  month: number;
  sales: number;
  purchases: number;
  expenses: number;
  netProfit: number;
};

export type OwnerOverviewComparisonRow = {
  companyId: string;
  nameAr: string;
  nameEn?: string | null;
  months: number[];
  total: number;
  shareOfGrandTotalPct: number | null;
  colorIndex: number;
};

export type OwnerOverviewComparison = {
  rows: OwnerOverviewComparisonRow[];
  grandMonthlyTotals: number[];
  grandTotal: number;
};

export type OwnerOverviewChartPoint = Record<string, string | number>;

export type OwnerOverviewExportRow = {
  companyId: string;
  companyNameAr: string;
  companyNameEn: string;
  sales: number;
  purchasesToSalesPct: number | null;
  expensesToSalesPct: number | null;
  netProfit: number;
};

export type OwnerOverviewData = {
  schemaVersion: 1;
  period: {
    year: number;
    month: number | null;
  };
  companies: OwnerOverviewCompany[];
  kpis: OwnerOverviewKpi[];
  companyRows: OwnerOverviewCompanyRow[];
  monthlyBuckets: OwnerOverviewMonthlyBucket[];
  comparison: Record<OwnerOverviewMetric, OwnerOverviewComparison>;
  monthlyPerformance: Record<OwnerOverviewMetric, OwnerOverviewChartPoint[]>;
  dailyPerformance: OwnerOverviewChartPoint[];
  exportRows: OwnerOverviewExportRow[];
};
