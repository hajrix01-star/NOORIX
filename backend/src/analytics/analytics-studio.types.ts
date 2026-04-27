/** شكل ناتج getPeriodAnalytics — يُعاد للواجهة كجزء من الاستوديو. */
export type PeriodAnalyticsBlock = {
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

export type AnalyticsStudioAlertSeverity = 'info' | 'warning';

export type AnalyticsStudioAlertDto = {
  id: string;
  severity: AnalyticsStudioAlertSeverity;
  messageAr: string;
  messageEn: string;
  sourceKey: string;
};

export type AnalyticsStudioCompanyRowDto = {
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
  mergedPeriodBlock: PeriodAnalyticsBlock;
  byCompany: AnalyticsStudioCompanyRowDto[];
  alerts: AnalyticsStudioAlertDto[];
};
