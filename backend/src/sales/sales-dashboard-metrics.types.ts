export type DashboardDailyMetricRow = {
  transactionDate: string;
  shift: string;
  totalAmount: string;
  customerCount: number;
};

export type DashboardDailyTotalMetricRow = {
  transactionDate: string;
  totalAmount: number;
  customerCount: number;
};

export type DashboardWeekdayAverageMetricRow = {
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

export type DashboardChannelMetricRow = {
  periodKey: string;
  vaultId: string;
  nameAr: string;
  nameEn: string | null;
  type: string | null;
  amount: string;
};

export type DashboardChannelBreakdownMetricRow = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  amount: number;
  sharePct: number | null;
};
