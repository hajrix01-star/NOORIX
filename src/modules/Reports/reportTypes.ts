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

export type ReportPeriodMode = 'year' | 'month';
