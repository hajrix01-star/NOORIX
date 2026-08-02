export type OrdersV4Unit = {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  dimension: string;
  canonicalFactor?: string | null;
  decimalScale: number;
  sortOrder?: number;
  isActive: boolean;
};

export type OrdersV4Category = { id: string; nameAr: string; nameEn?: string | null; isActive: boolean };
export type OrdersV4Section = { id: string; code: string; nameAr: string; nameEn?: string | null; isActive: boolean };
export type OrdersV4Location = { id: string; code: string; nameAr: string; nameEn?: string | null; kind: string; isActive: boolean; section?: OrdersV4Section | null };

export type OrdersV4Item = {
  id: string;
  sku?: string | null;
  nameAr: string;
  nameEn?: string | null;
  itemType: 'purchased' | 'sale';
  categoryId?: string | null;
  inventoryUnitId: string;
  trackInventory: boolean;
  isActive: boolean;
  inventoryUnit: OrdersV4Unit;
  units: Array<{
    id: string;
    unitId: string;
    purchaseLabel?: string | null;
    isOrderEnabled: boolean;
    lastPrice?: string | null;
    lastPriceAt?: string | null;
    isActive: boolean;
    sortOrder: number;
    unit: OrdersV4Unit;
  }>;
  category?: OrdersV4Category | null;
  sections: Array<{ section: OrdersV4Section }>;
};

export type OrdersV4ConversionVersion = {
  id: string;
  itemId: string;
  version: number;
  status: string;
  item: OrdersV4Item;
  edges: Array<{
    id: string;
    fromUnitId: string;
    toUnitId: string;
    factor: string;
    reversible: boolean;
    allowDimensionBridge: boolean;
    fromUnit: OrdersV4Unit;
    toUnit: OrdersV4Unit;
  }>;
};

export type OrdersV4RecipeVersion = {
  id: string;
  outputItemId: string;
  outputQuantity: string;
  outputUnitId: string;
  version: number;
  status: string;
  estimatedCost: string;
  costPolicy: 'simple-average-last-5-received-purchase-orders';
  outputItem: OrdersV4Item;
  outputUnit: OrdersV4Unit;
  lines: Array<{
    id: string;
    componentItemId: string;
    quantity: string;
    unitId: string;
    componentItem: OrdersV4Item;
    unit: OrdersV4Unit;
  }>;
};

export type OrdersV4Bootstrap = {
  kernelVersion: 4;
  units: OrdersV4Unit[];
  categories: OrdersV4Category[];
  sections: OrdersV4Section[];
  items: OrdersV4Item[];
  locations: OrdersV4Location[];
  conversions: OrdersV4ConversionVersion[];
  recipes: OrdersV4RecipeVersion[];
};

export type OrdersV4UserIdentity = {
  id: string;
  nameAr?: string | null;
  nameEn?: string | null;
  username?: string | null;
};

export type OrdersV4DocumentLine = {
  id: string;
  lineNumber: number;
  itemId: string;
  itemNameSnapshot: string;
  inputQuantity: string;
  inputUnitId: string;
  baseQuantity: string;
  baseUnitId: string;
  unitPrice: string;
  priceUnitId: string;
  priceQuantity: string;
  lineTotal: string;
  operationalCost: string;
  item: OrdersV4Item;
  inputUnit: OrdersV4Unit;
  baseUnit: OrdersV4Unit;
  priceUnit: OrdersV4Unit;
};

export type OrdersV4Document = {
  id: string;
  documentNumber: string;
  documentType: 'purchase' | 'registration';
  paymentMethod?: 'custody' | 'cash' | 'transfer' | null;
  documentDate: string;
  status: 'prepared' | 'received' | 'cancelled' | 'reversed';
  revision: number;
  receivedAt?: string | null;
  createdAt: string;
  sectionId?: string | null;
  locationId: string;
  pettyCashAmount?: string | null;
  subtotal: string;
  totalAmount: string;
  operationalCost: string;
  notes?: string | null;
  createdByUser?: OrdersV4UserIdentity | null;
  section?: OrdersV4Section | null;
  location: OrdersV4Location;
  lines: OrdersV4DocumentLine[];
};

export type OrdersV4Summary = {
  purchaseCount: number;
  registrationCount: number;
  purchaseTotal: string;
  registrationTotal: string;
  custodyTotal: string;
  cashTotal: string;
  transferTotal: string;
  cashSalesImported: string;
  cashUsed: string;
  cashAvailable: string;
  custodyFunded: string;
  custodySpent: string;
  custodyBalance: string;
  kernelVersion: 4;
};

export type OrdersV4ItemsReportRow = {
  itemId: string;
  nameAr: string;
  categoryName: string;
  inventoryUnit: string;
  documentCount: number;
  baseQuantity: string;
  totalAmount: string;
  averageUnitCost: string;
};

export type OrdersV4SalesReport = {
  kernelVersion: 4;
  summary: { count: number; totalAmount: string };
  byItem: OrdersV4ItemsReportRow[];
  bySection: Array<{ sectionId: string; sectionName: string; count: number; totalAmount: string }>;
  documents: OrdersV4Document[];
};

export type OrdersV4InventoryBalance = {
  itemId: string;
  itemName: string;
  categoryName: string;
  unitCode: string;
  unitName: string;
  locationId: string;
  locationName: string;
  quantity: string;
  value: string;
  averageUnitCost: string;
  lastSequence: string;
  updatedAt: string;
  createdByUser?: OrdersV4UserIdentity | null;
};

export type OrdersV4LedgerEntry = {
  id: string;
  sequence: string;
  effectiveAt: string;
  entryType: string;
  quantityDelta: string;
  unitCost: string;
  valueDelta: string;
  quantityAfter: string;
  valueAfter: string;
  averageUnitCostAfter: string;
  sourceType: string;
  inventoryUnitId: string;
  inventoryUnit: OrdersV4Unit;
  item: OrdersV4Item;
  location: OrdersV4Location;
  createdByUser?: OrdersV4UserIdentity | null;
};

export type OrdersV4DataQuality = {
  kernelVersion: 4;
  itemCount: number;
  errorCount: number;
  warningCount: number;
  ready: boolean;
  issues: Array<{ code: string; severity: 'warning' | 'error'; itemId: string; itemName: string; message: string }>;
};

export type OrdersV4CutoverAudit = {
  audit: 'orders-v4-legacy-cutover';
  readOnly: true;
  generatedAt: string;
  company: { id: string; nameAr?: string | null; nameEn?: string | null };
  ready: boolean;
  sourceFingerprint: string;
  source: Record<string, string | number>;
  target: Record<string, string | number>;
  issueCounts: { errors: number; warnings: number };
  issues: Array<{
    severity: 'error' | 'warning';
    code: string;
    entity: string;
    entityId?: string;
    message: string;
  }>;
};

export type OrdersV4CutoverResult = {
  cutover: 'legacy-orders-to-v4';
  runId: string;
  executedAt: string;
  sourceFingerprint: string;
  passed: boolean;
  checks: Record<string, boolean>;
  source: Record<string, string | number>;
  target: Record<string, string | number>;
};

export type OrdersV4Stocktake = {
  id: string;
  stocktakeNumber: string;
  stocktakeDate: string;
  status: string;
  location: OrdersV4Location;
  createdByUser?: OrdersV4UserIdentity | null;
  lines: Array<{
    id: string;
    expectedQuantity: string;
    physicalQuantity: string;
    varianceQuantity: string;
    varianceValue: string;
    item: OrdersV4Item;
    unit: OrdersV4Unit;
  }>;
};

export type OrdersV4DocumentPayload = {
  documentType: 'purchase' | 'registration';
  documentDate: string;
  paymentMethod?: 'custody' | 'cash' | 'transfer' | null;
  sectionId?: string | null;
  locationId: string;
  pettyCashAmount?: string | null;
  notes?: string | null;
  idempotencyKey: string;
  lines: Array<{ itemId: string; quantity: string; unitId: string; unitPrice?: string; priceUnitId?: string }>;
};

export type OrdersV4ReceivePayload = Omit<OrdersV4DocumentPayload, 'documentType'> & { revision: number };
