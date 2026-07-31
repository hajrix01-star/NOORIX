export type OrderProductType = 'order' | 'sale';
export type OrderType = 'external' | 'internal' | 'transfer';
export type StaffOrderType = 'order' | 'sale';
export type StaffOrderStatus = 'pending' | 'sent' | 'cancelled';
export type StaffOrderEntryType = 'issue' | 'cancellation';
export type StaffCancellationReason =
  | 'customer_disliked'
  | 'replaced_item'
  | 'order_error'
  | 'registration_error'
  | 'delayed_order'
  | 'duplicate_order'
  | 'customer_changed_mind'
  | 'item_unavailable'
  | 'other';
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
  quantityMultiplier?: MoneyLike | null;
};

export type OrderProductUnitConversion = {
  fromUnit: string;
  toUnit: string;
  multiplier: MoneyLike;
  label?: string | null;
};

export type OrderCatalogUnit = {
  id: string;
  companyId?: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  kind?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
};

export type OrderCatalogUnitPayload = {
  companyId?: string;
  code?: string;
  nameAr: string;
  nameEn?: string | null;
  kind?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type OrderConversionTemplate = {
  id: string;
  companyId?: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  description?: string | null;
  conversions?: OrderProductUnitConversion[] | unknown;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
};

export type OrderConversionTemplatePayload = {
  companyId?: string;
  code?: string;
  nameAr: string;
  nameEn?: string | null;
  description?: string | null;
  conversions?: OrderProductUnitConversion[];
  isActive?: boolean;
  sortOrder?: number;
};

export type OrderProductRecipeMaterialType = 'material' | 'tobacco' | 'hose' | 'charcoal';
export type OrderProductRecipeUnit = 'g' | 'kg' | 'ml' | 'l' | 'piece' | 'pack' | 'box' | 'carton';

export type OrderProductRecipeItem = {
  materialType: OrderProductRecipeMaterialType;
  materialProductId: string;
  quantity: MoneyLike;
  unit: OrderProductRecipeUnit | string;
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
  inventoryConversions?: OrderProductUnitConversion[] | unknown;
  conversionTemplateId?: string | null;
  conversionTemplate?: OrderConversionTemplate | null;
  recipe?: OrderProductRecipeItem[] | unknown;
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
  quantityMultiplier?: MoneyLike | null;
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
  transferPurchasesTotal: MoneyLike;
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
  baseUnit?: string | null;
  size?: string | null;
  packaging?: string | null;
  sectionName?: string | null;
  sectionNames?: string[];
  sectionIds?: string[];
  quantity: MoneyLike;
  normalizedQuantity?: MoneyLike;
  amount: MoneyLike;
  orderCount: number;
  orderIds?: string[];
  orderTypes?: string[];
  averageUnitPrice?: MoneyLike;
  lastOrderDate?: string | null;
  daily?: OrderItemsReportDailyRow[];
};

export type OrderItemsReportDailyRow = {
  date: string;
  quantity: MoneyLike;
  normalizedQuantity: MoneyLike;
  amount: MoneyLike;
  orderCount: number;
  orderIds?: string[];
};

export type OrderItemsReportResult = {
  rows: OrderItemsReportRow[];
  summary: {
    totalAmount: MoneyLike;
    distinctOrders: number;
    distinctProducts: number;
    sectionsCount: number;
  };
};

export type OrderRecipeInventoryStockRow = {
  productId: string;
  productNameAr: string;
  productNameEn: string | null;
  sections: string[];
  sectionIds: string[];
  unit: string;
  purchasedBaseQuantity: MoneyLike;
  consumedBaseQuantity: MoneyLike;
  balanceBaseQuantity: MoneyLike;
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
  inventoryConversions?: OrderProductUnitConversion[];
  conversionTemplateId?: string | null;
  recipe?: OrderProductRecipeItem[];
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
  quantityMultiplier?: MoneyLike | null;
  unit?: string | null;
  size?: string | null;
  packaging?: string | null;
  unitPrice?: MoneyLike | null;
  notes?: string | null;
  cancellationReasons?: StaffCancellationReason[] | null;
  sectionName?: string | null;
};

export type StaffOrder = {
  id: string;
  companyId: string;
  userId?: string;
  sectionName: string;
  orderType?: StaffOrderType | string;
  entryType?: StaffOrderEntryType | string;
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
  cancellationReasons?: StaffCancellationReason[];
  sectionName?: string;
};

export type StaffOrderPayload = {
  companyId: string;
  sectionName?: string;
  orderType: StaffOrderType;
  entryType?: StaffOrderEntryType;
  saleDate?: string;
  notes?: string;
  items: StaffOrderLinePayload[];
  lang?: DisplayLanguage;
};

export type StaffSaleNextLogRef = {
  logRef: string;
};

export type StaffSaleDateStatus = {
  sectionName: string;
  today: string;
  suggestedDate: string;
  lastSectionDate: string | null;
  lastUserDate: string | null;
};

export type StaffRegistrationMissingDay = {
  date: string;
  sectionName: string;
};

export type StaffRegistrationSectionCoverage = {
  sectionName: string;
  firstRegisteredDate: string | null;
  lastRegisteredDate: string | null;
  expectedDays: number;
  registeredDays: number;
  missingDays: number;
  missingDates: string[];
};

export type StaffRegistrationCoverage = {
  startDate: string;
  endDate: string;
  expectedSectionDays: number;
  registeredSectionDays: number;
  missingSectionDays: number;
  affectedSections: number;
  sections: StaffRegistrationSectionCoverage[];
  missingDays: StaffRegistrationMissingDay[];
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
  totalAmount: number;
  averageAmount: number;
};

export type StaffSaleReportUserRow = {
  userId: string;
  username?: string | null;
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
  username?: string | null;
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
  registrationCoverage: StaffRegistrationCoverage;
};

export type OrderCatalogBatchCreateResult = {
  created?: number;
  count?: number;
  items?: Array<OrderProduct | OrderCategory>;
  [key: string]: unknown;
} | Array<OrderProduct | OrderCategory>;
