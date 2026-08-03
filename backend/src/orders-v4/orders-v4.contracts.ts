export type OrdersV4DocumentType = 'purchase' | 'registration';
export type OrdersV4PaymentMethod = 'custody' | 'cash' | 'transfer';
export type OrdersV4RegistrationEntryType = 'issue' | 'cancellation';
export type OrdersV4CancellationReason =
  | 'customer_disliked'
  | 'replaced_item'
  | 'order_error'
  | 'registration_error'
  | 'delayed_order'
  | 'duplicate_order'
  | 'customer_changed_mind'
  | 'item_unavailable'
  | 'other';

export type OrdersV4ReportFilters = {
  sectionIds?: string[];
  categoryIds?: string[];
  itemIds?: string[];
  baseUnitIds?: string[];
  inputUnitIds?: string[];
  paymentMethods?: OrdersV4PaymentMethod[];
  statuses?: Array<'prepared' | 'received' | 'cancelled' | 'reversed'>;
  registrationEntryTypes?: OrdersV4RegistrationEntryType[];
  cancellationReasons?: OrdersV4CancellationReason[];
  createdByUserIds?: string[];
  search?: string;
};

export type OrdersV4UnitInput = {
  code: string;
  nameAr: string;
  nameEn?: string | null;
  dimension: string;
  canonicalFactor?: string | null;
  decimalScale?: number;
};

export type OrdersV4NamedInput = {
  nameAr: string;
  nameEn?: string | null;
  code?: string;
  sortOrder?: number;
};

export type OrdersV4ItemInput = {
  sku?: string | null;
  nameAr: string;
  nameEn?: string | null;
  itemType: 'purchased' | 'sale';
  categoryId?: string | null;
  inventoryUnitId: string;
  sectionIds?: string[];
  trackInventory?: boolean;
  sortOrder?: number;
  units?: Array<{
    unitId: string;
    purchaseLabel?: string | null;
    isOrderEnabled?: boolean;
    lastPrice?: string | null;
    sortOrder?: number;
  }>;
};

export type OrdersV4ItemUnitsInput = {
  inventoryUnitId: string;
  units: Array<{
    unitId: string;
    purchaseLabel?: string | null;
    isOrderEnabled?: boolean;
    lastPrice?: string | null;
    sortOrder?: number;
  }>;
};

export type OrdersV4ItemUpdateInput = Pick<OrdersV4ItemInput,
  'sku' | 'nameAr' | 'nameEn' | 'categoryId' | 'sectionIds' | 'trackInventory' | 'sortOrder'
>;

export type OrdersV4ConversionPublishInput = {
  itemId: string;
  edges: Array<{
    fromUnitId: string;
    toUnitId: string;
    factor: string;
    reversible?: boolean;
    allowDimensionBridge?: boolean;
  }>;
};

export type OrdersV4ItemDefinitionInput = {
  inventoryUnitId: string;
  edges: OrdersV4ConversionPublishInput['edges'];
  units: OrdersV4ItemUnitsInput['units'];
};

export type OrdersV4RecipePublishInput = {
  outputItemId: string;
  outputQuantity: string;
  outputUnitId: string;
  lines: Array<{ componentItemId: string; quantity: string; unitId: string }>;
};

export type OrdersV4DocumentInput = {
  documentType: OrdersV4DocumentType;
  registrationEntryType?: OrdersV4RegistrationEntryType;
  documentDate: string;
  paymentMethod?: OrdersV4PaymentMethod | null;
  sectionId?: string | null;
  locationId: string;
  pettyCashAmount?: string | null;
  notes?: string | null;
  idempotencyKey: string;
  lines: Array<{
    itemId: string;
    quantity: string;
    unitId: string;
    unitPrice?: string;
    priceUnitId?: string;
    cancellationReasons?: OrdersV4CancellationReason[] | null;
    cancellationNote?: string | null;
  }>;
};

export type OrdersV4ReceiveInput = Omit<OrdersV4DocumentInput, 'documentType' | 'idempotencyKey'> & {
  revision: number;
  idempotencyKey: string;
};

export type OrdersV4CustodyInput = {
  amount: string;
  effectiveDate: string;
  notes?: string | null;
  idempotencyKey: string;
};

export type OrdersV4StocktakeInput = {
  stocktakeDate: string;
  locationId: string;
  notes?: string | null;
  idempotencyKey: string;
  lines: Array<{
    itemId: string;
    /** Backward-compatible inventory-unit quantity. New clients send physicalUnits. */
    physicalQuantity?: string;
    physicalUnits?: Array<{ unitId: string; quantity: string }>;
  }>;
};
