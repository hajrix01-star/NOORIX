/**
 * أنواع لوحة المالك — عقود العرض فقط؛ لا تغيّر شكل استجابات API.
 */
import type { CompanyListItem } from '../../context/appTypes';

export type OwnerDashboardMetric = 'sales' | 'purchases' | 'expenses' | 'netProfit';

/** خيار شركة في الفلاتر — يطابق عناصر قائمة الشركات */
export type OwnerCompanyOption = Pick<CompanyListItem, 'id' | 'nameAr' | 'nameEn'> & {
  isArchived?: boolean;
};

export type OwnerPlReport = {
  cards?: Record<string, string | number | undefined>;
  summaryRows?: Array<{ key?: string; months?: Array<string | number | undefined> }>;
  groups?: Array<{ key?: string; months?: Array<string | number | undefined> }>;
};

export type OwnerKpiTotals = {
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  totalNetProfit: number;
  byCompany: Array<{
    companyId: string;
    name: string;
    sales: number;
    purchases: number;
    expenses: number;
    netProfit: number;
  }>;
};

export type OwnerMonthlyBucket = {
  sales: number;
  purchases: number;
  expenses: number;
  netProfit: number;
};

export type OwnerMonthlyComparisonRow = {
  cid: string;
  name: string;
  months: number[];
  total: number;
  color: string;
};

/** صف رسم بياني — مفتاح ديناميكي لكل companyId + label */
export type OwnerChartPoint = Record<string, string | number>;

export type OwnerExportRow = Record<string, string | number>;

export type OwnerCompanySeries = {
  key: string;
  label: string;
  color: string;
  gradId: string;
};

export type OwnerDailySalesItem = {
  transactionDate?: string | null;
  status?: string | null;
  totalAmount?: string | number | null;
};
