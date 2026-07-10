export type OrderProductType = 'order' | 'sale';
export type OrderType = 'external' | 'internal';
export type StaffOrderType = 'order' | 'sale';
export type StaffOrderStatus = 'pending' | 'sent' | 'cancelled';
export type DisplayLanguage = 'ar' | 'en';
export type MoneyLike = string | number;

export type NamedDisplayRef = {
  id?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  name?: string | null;
};

export type OrderProductVariant = {
  size?: string | null;
  packaging?: string | null;
  unit?: string | null;
  lastPrice?: MoneyLike | null;
};

export type OrderCategory = {
  id: string;
  companyId?: string;
  nameAr: string;
  nameEn?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

export type OrderSection = {
  id: string;
  companyId?: string;
  nameAr: string;
  nameEn?: string | null;
  sortOrder?: number;
};

export type OrderProduct = {
  id: string;
  companyId?: string;
  nameAr: string;
  nameEn?: string | null;
  unit?: string | null;
  sizes?: string | null;
  packaging?: string | null;
  categoryId?: string | null;
  category?: OrderCategory | null;
  productType?: OrderProductType | string | null;
  lastPrice?: MoneyLike | null;
  variants?: OrderProductVariant[] | unknown;
  sections?: string[] | null;
  sectionIds?: string[] | null;
  sortOrder?: number;
  isActive?: boolean;
};

export type OrderLine = {
  id?: string;
  orderId?: string;
  productId: string;
  product?: OrderProduct | null;
  size?: string | null;
  packaging?: string | null;
  unit?: string | null;
  quantity: MoneyLike;
  unitPrice: MoneyLike;
  amount: MoneyLike;
};

export type OrderRecord = {
  id: string;
  companyId: string;
  orderNumber: string;
  orderDate: string;
  orderType: OrderType | string;
  pettyCashAmount?: MoneyLike | null;
  totalAmount: MoneyLike;
  notes?: string | null;
  status?: string | null;
  items?: OrderLine[];
  sourceStaffOrderIds?: string[] | null;
};

export type OrderSummary = {
  pettyCashTotal: MoneyLike;
  delegatePurchasesTotal: MoneyLike;
  localPurchasesTotal: MoneyLike;
  delegateBalance: MoneyLike;
  cashRemaining?: MoneyLike;
};

export type OrderRangeSummary = OrderSummary & {
  cashSalesTotal: MoneyLike;
  filteredTotal: MoneyLike;
};

export type OrderItemsReportRow = {
  id?: string;
  productId: string;
  nameAr?: string | null;
  nameEn?: string | null;
  productNameAr?: string | null;
  productNameEn?: string | null;
  categoryId?: string | null;
  categoryNameAr?: string | null;
  categoryNameEn?: string | null;
  unit?: string | null;
  quantity: MoneyLike;
  amount: MoneyLike;
  orderCount: number;
};

export type OrderPurchaseHistoryRow = {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  quantity: MoneyLike;
  unitPrice: MoneyLike;
  amount: MoneyLike;
  productNameAr?: string | null;
  productNameEn?: string | null;
  categoryNameAr?: string | null;
  categoryNameEn?: string | null;
};

export type CreateOrderLinePayload = {
  productId: string;
  size?: string;
  packaging?: string;
  unit?: string;
  quantity: string;
  unitPrice: string;
};

export type CreateOrderPayload = {
  companyId: string;
  orderDate: string;
  orderType: OrderType;
  pettyCashAmount?: string;
  notes?: string;
  items: CreateOrderLinePayload[];
};

export type UpdateOrderPayload = Partial<Omit<CreateOrderPayload, 'companyId'>> & {
  items?: CreateOrderLinePayload[];
};

export type OrderProductPayload = {
  companyId?: string;
  nameAr: string;
  nameEn?: string | null;
  unit?: string;
  sizes?: string | null;
  packaging?: string | null;
  categoryId?: string | null;
  lastPrice?: string;
  sections?: string[] | null;
  sectionIds?: string[] | null;
  productType?: OrderProductType;
  variants?: OrderProductVariant[];
  isActive?: boolean;
};

export type OrderCategoryPayload = {
  companyId?: string;
  nameAr: string;
  nameEn?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

export type OrderSectionPayload = {
  companyId?: string;
  nameAr: string;
  nameEn?: string | null;
  sortOrder?: number;
};

export type StaffOrderItem = {
  id?: string;
  productId: string;
  product?: OrderProduct | null;
  quantity: MoneyLike;
  unit?: string | null;
  size?: string | null;
  packaging?: string | null;
  unitPrice?: MoneyLike | null;
  notes?: string | null;
  sectionName?: string | null;
};

export type StaffOrder = {
  id: string;
  companyId: string;
  userId?: string;
  sectionName: string;
  orderType?: StaffOrderType | string;
  status?: StaffOrderStatus | string;
  logRef?: string | null;
  whatsAppText?: string | null;
  saleDate?: string | null;
  sentAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  notes?: string | null;
  items?: StaffOrderItem[];
  user?: NamedDisplayRef | null;
};

export type StaffOrderLinePayload = {
  productId: string;
  quantity: string;
  unit?: string;
  size?: string;
  packaging?: string;
  unitPrice?: string;
  notes?: string;
  sectionName?: string;
};

export type StaffOrderPayload = {
  companyId: string;
  sectionName?: string;
  orderType: StaffOrderType;
  saleDate?: string;
  notes?: string;
  items: StaffOrderLinePayload[];
  lang?: DisplayLanguage;
};

export type StaffSaleNextLogRef = {
  logRef: string;
};

export type StaffSaleReportSummary = {
  totalOrders: number;
  totalQty: number;
  totalAmount: number;
  avgPerOrder: number;
  uniqueProducts: number;
  uniqueSections: number;
};

export type StaffSaleReportProductRow = {
  productId: string;
  nameAr?: string | null;
  nameEn?: string | null;
  qty: number;
  unit?: string | null;
  sections: string[];
};

export type StaffSaleReportSectionRow = {
  sectionName: string;
  qty: number;
  ordersCount: number;
};

export type StaffSaleReportUserRow = {
  userId: string;
  nameAr?: string | null;
  nameEn?: string | null;
  ordersCount: number;
  qty: number;
};

export type StaffSaleReportDayRow = {
  date: string;
  ordersCount: number;
  qty: number;
};

export type StaffSaleReportLogRow = {
  operationKey: string;
  logRef?: string | null;
  date: string;
  userId: string;
  nameAr?: string | null;
  nameEn?: string | null;
  qty: number;
  totalAmount: number;
  avgPerOrder: number;
  sectionsCount: number;
  sections: string[];
};

export type StaffSaleReport = {
  summary: StaffSaleReportSummary;
  byProduct: StaffSaleReportProductRow[];
  bySection: StaffSaleReportSectionRow[];
  byUser: StaffSaleReportUserRow[];
  byDay: StaffSaleReportDayRow[];
  byLog: StaffSaleReportLogRow[];
};

export type DigestHistoryItem = {
  nameAr?: string | null;
  nameEn?: string | null;
  qty: number;
  unit?: string | null;
};

export type DigestHistorySection = {
  sectionName: string;
  ordersCount: number;
  items: DigestHistoryItem[];
};

export type DigestHistoryDay = {
  date: string;
  sentAt: string;
  sections: DigestHistorySection[];
};

export type OrderCatalogBatchCreateResult = {
  created?: number;
  count?: number;
  items?: Array<OrderProduct | OrderCategory>;
  [key: string]: unknown;
} | Array<OrderProduct | OrderCategory>;
