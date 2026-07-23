export type SalesShiftValue = 'all' | 'morning' | 'evening';
export type SalesListShiftFilter = 'any' | SalesShiftValue;

export type SalesVaultRef = {
  id?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  name?: string | null;
  sortOrder?: number | null;
  type?: string | null;
  paymentMethod?: string | null;
};

export type SalesInputVaultRef = SalesVaultRef & { id: string };

export type SalesChannelEntry = {
  vaultId?: string;
  amount?: number | string | null;
  vault?: SalesVaultRef | null;
};

export type SalesDayContextSource = 'saudi' | 'school' | 'manual';
export type SalesDayContextType = 'occasion' | 'school_holiday' | 'special_day';

export type SalesDayContextEvent = {
  id: string;
  name: string;
  type: SalesDayContextType;
  source: SalesDayContextSource;
  fromDate: string;
  toDate: string;
  color: string;
};

export type SalesDayContext = {
  version: 1;
  date: string;
  isSpecialDay: true;
  primary: SalesDayContextEvent;
  events: SalesDayContextEvent[];
};

export type SalesSummaryItem = {
  id: string;
  summaryNumber?: string | number | null;
  transactionDate?: string | null;
  customerCount: number;
  totalAmount: number;
  cashOnHand: number;
  avgPerCustomer: number;
  notes?: string | null;
  dayContext?: SalesDayContext | null;
  status: string;
  shift: SalesShiftValue;
  channels: SalesChannelEntry[];
  channelsText: string;
};

export type SalesSummaryDayRow = SalesSummaryItem & {
  id: string;
  summaryNumbersText: string;
  shiftsText: string;
  summaries: SalesSummaryItem[];
};

export type SalesSummaryPageSummary = {
  rowCount: number;
  customerCount: number;
  totalAmount: number;
  avgPerCustomer: number;
};

export type SalesSummariesPage = {
  items: SalesSummaryItem[];
  dayRows: SalesSummaryDayRow[];
  pageSummary: SalesSummaryPageSummary;
  total: number;
  page: number;
  pageSize: number;
};

export type SalesSummaryChannelPayload = {
  vaultId: string;
  amount: string;
};

export type CreateSalesSummaryBody = {
  companyId: string;
  transactionDate: string;
  customerCount: number;
  shift: SalesShiftValue;
  cashOnHand?: string;
  channels: SalesSummaryChannelPayload[];
  notes?: string;
  idempotencyKey?: string;
};

export type UpdateSalesSummaryBody = {
  transactionDate?: string;
  customerCount?: number;
  shift?: SalesShiftValue;
  cashOnHand?: string;
  channels?: SalesSummaryChannelPayload[];
  notes?: string;
};

export type DailySalesBatchItem = {
  shift: SalesShiftValue;
  customerCount: number;
  cashOnHand?: string;
  channels: SalesSummaryChannelPayload[];
  notes?: string;
};

export type DailySalesBatchPayload = {
  companyId: string;
  transactionDate: string;
  items: DailySalesBatchItem[];
  batchIdempotencyKey?: string;
};

export type SalesMutationResult = {
  summary?: SalesSummaryItem;
  summaries?: SalesSummaryItem[];
};
