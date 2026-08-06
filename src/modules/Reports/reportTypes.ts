export type GeneralPnlAmountBasis = 'gross_including_vat';

export type PlRowType = 'group' | 'category' | 'item' | 'summary';

export type GeneralProfitLossRow = {
  key: string;
  labelAr: string;
  labelEn?: string;
  months: string[];
  total: string;
  percentOfSalesMonths: string[];
  percentOfSalesYear: string;
  rowType?: PlRowType;
  groupKey?: string;
  itemKey?: string | null;
  collapseKey?: string | null;
  depth?: number;
  children?: GeneralProfitLossRow[];
};

export type GeneralProfitLossGroup = GeneralProfitLossRow & {
  items: GeneralProfitLossRow[];
};

export type GeneralProfitLossReport = {
  amountBasis: GeneralPnlAmountBasis;
  months: Array<{ index: number; label: string }>;
  groups: GeneralProfitLossGroup[];
  summaryRows: GeneralProfitLossRow[];
  cards: {
    sales: string;
    purchases: string;
    expenses: string;
    grossProfit: string;
    netProfit: string;
  };
};

export type ReportPeriodMode = 'year' | 'quarter' | 'month';

export type PlDisplayRowType = PlRowType | 'groupTotal';

export type PlDisplayRow = Omit<GeneralProfitLossRow, 'rowType' | 'children'> & {
  rowType?: PlDisplayRowType;
  originalRowType?: PlRowType;
  groupKey?: string;
  itemKey?: string | null;
  collapseKey?: string | null;
  depth?: number;
  children?: PlDisplayRow[];
  items?: PlDisplayRow[];
};

export type ReportDetailState = {
  month: number | null;
  groupKey: string;
  itemKey?: string | null;
  showTrend?: boolean;
};

export type ReportDetailInvoiceItem = {
  id: string;
  transactionDate?: unknown;
  summaryNumber?: string | null;
  invoiceNumber?: string | null;
  supplierNameAr?: string | null;
  supplierNameEn?: string | null;
  itemLabelAr?: string | null;
  itemLabelEn?: string | null;
  reportAmount?: string | number | null;
  totalAmount?: string | number | null;
  netAmount?: string | number | null;
  taxAmount?: string | number | null;
  percentOfSales?: string | number | null;
  percentOfTotal?: string | number | null;
  notes?: string | null;
  channelNames?: Array<{ nameAr?: string | null; nameEn?: string | null }>;
};

export type ReportDetailDerivedItem = {
  key: string;
  labelAr: string;
  labelEn?: string | null;
  amount: string | number;
};

export type ReportDetailsData = {
  kind: 'invoices' | 'derived';
  titleAr: string;
  titleEn?: string | null;
  month?: number | null;
  monthLabel?: string | null;
  contextAmount?: string | number | null;
  annualAmount?: string | number | null;
  contextPercentOfSales?: string | number | null;
  detailSource?: 'ledger' | 'invoices';
  invoiceCount?: string | number | null;
  documentsAmount?: string | number | null;
  documentsComplete?: boolean | null;
  documentsMatchContext?: boolean | null;
  items?: Array<ReportDetailInvoiceItem | ReportDetailDerivedItem>;
};

export type ReportTrendPoint = {
  month: number;
  label: string;
  amount?: string | number | null;
  percentOfSales?: string | number | null;
};

export type ReportTrendData = {
  total?: string | number | null;
  percentOfSalesYear?: string | number | null;
  points: ReportTrendPoint[];
};

export type PeriodAnalyticsData = {
  totalsByKind?: Record<
    string,
    {
      totalAmount?: string | number | null;
      invoiceCount?: string | number | null;
    }
  >;
  topSuppliers?: Array<{
    supplierId: string;
    nameAr?: string | null;
    nameEn?: string | null;
    totalAmount?: string | number | null;
    invoiceCount?: string | number | null;
  }>;
};

export type TaxDisclosureRowValue = {
  amount: number;
  adjustment: number;
  vat: number;
};

export type TaxDisclosureData = Record<string, number | TaxDisclosureRowValue>;
