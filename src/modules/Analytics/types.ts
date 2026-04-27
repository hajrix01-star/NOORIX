/**
 * أنواع طلب/رد Analytics Studio — يجب أن تبقى متوافقة مع `GET /api/v1/analytics/studio`.
 * المصدر الحقيقي للحسابات: `backend/src/reports/reports-period-analytics.service.ts` (عبر التجميع في الـ backend).
 */
export type AnalyticsPeriodBlock = {
  startDate: string;
  endDate: string;
  totalsByKind: Record<string, { totalAmount: string; invoiceCount: number }>;
  topSuppliers: Array<{
    supplierId: string;
    nameAr: string;
    totalAmount: string;
    invoiceCount: number;
  }>;
  supplierCategoryBreakdown: Array<{
    categoryId: string | null;
    nameAr: string;
    nameEn: string | null;
    count: number;
  }>;
  suppliersInPeriodCount: number;
  purchaseCategoryBreakdown: Array<{
    categoryId: string | null;
    nameAr: string;
    nameEn: string | null;
    amount: string;
  }>;
  purchaseCategoryTotal: string;
};

export type AnalyticsStudioAlert = {
  id: string;
  severity: 'info' | 'warning';
  messageAr: string;
  messageEn: string;
  sourceKey: string;
};

export type AnalyticsStudioCompanyRow = {
  companyId: string;
  nameAr: string;
  nameEn: string | null;
  totalSales: string;
  totalPurchases: string;
  totalOutflow: string;
  totalInvoices: number;
  netInvoiceFlow: string;
};

export type AnalyticsStudioPayload = {
  startDate: string;
  endDate: string;
  companyScope: 'all' | 'single';
  companyIdsIncluded: string[];
  dataSource: 'reports.getPeriodAnalytics';
  kpis: {
    totalSales: string;
    totalPurchases: string;
    totalOutflow: string;
    totalInvoices: number;
    netInvoiceFlow: string;
    sourceKey: string;
  };
  mergedPeriodBlock: AnalyticsPeriodBlock;
  byCompany: AnalyticsStudioCompanyRow[];
  alerts: AnalyticsStudioAlert[];
};
