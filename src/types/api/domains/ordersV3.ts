export type OrdersV3Unit = {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  dimension: string;
  canonicalFactor?: string | null;
  decimalScale: number;
  isActive: boolean;
};

export type OrdersV3Category = { id: string; nameAr: string; nameEn?: string | null; isActive: boolean };
export type OrdersV3Section = { id: string; code: string; nameAr: string; nameEn?: string | null; isActive: boolean };
export type OrdersV3Location = { id: string; code: string; nameAr: string; nameEn?: string | null; kind: string; isActive: boolean; section?: OrdersV3Section | null };

export type OrdersV3Item = {
  id: string;
  sku?: string | null;
  nameAr: string;
  nameEn?: string | null;
  itemType: 'purchased' | 'sale' | 'both';
  categoryId?: string | null;
  baseUnitId: string;
  trackInventory: boolean;
  isActive: boolean;
  baseUnit: OrdersV3Unit;
  category?: OrdersV3Category | null;
  sections: Array<{ section: OrdersV3Section }>;
};

export type OrdersV3ConversionVersion = {
  id: string;
  itemId: string;
  version: number;
  status: string;
  item: OrdersV3Item;
  edges: Array<{
    id: string;
    fromUnitId: string;
    toUnitId: string;
    factor: string;
    reversible: boolean;
    allowDimensionBridge: boolean;
    fromUnit: OrdersV3Unit;
    toUnit: OrdersV3Unit;
  }>;
};

export type OrdersV3RecipeVersion = {
  id: string;
  outputItemId: string;
  outputQuantity: string;
  outputUnitId: string;
  version: number;
  status: string;
  outputItem: OrdersV3Item;
  outputUnit: OrdersV3Unit;
  lines: Array<{
    id: string;
    componentItemId: string;
    quantity: string;
    unitId: string;
    wastePercent: string;
    componentItem: OrdersV3Item;
    unit: OrdersV3Unit;
  }>;
};

export type OrdersV3Bootstrap = {
  kernelVersion: 3;
  units: OrdersV3Unit[];
  categories: OrdersV3Category[];
  sections: OrdersV3Section[];
  items: OrdersV3Item[];
  locations: OrdersV3Location[];
  conversions: OrdersV3ConversionVersion[];
  recipes: OrdersV3RecipeVersion[];
};

export type OrdersV3DocumentLine = {
  id: string;
  lineNumber: number;
  itemId: string;
  itemNameSnapshot: string;
  inputQuantity: string;
  baseQuantity: string;
  unitPrice: string;
  priceQuantity: string;
  lineTotal: string;
  item: OrdersV3Item;
  inputUnit: OrdersV3Unit;
  priceUnit: OrdersV3Unit;
};

export type OrdersV3Document = {
  id: string;
  documentNumber: string;
  documentType: 'purchase' | 'registration';
  paymentMethod?: 'external' | 'internal' | 'transfer' | null;
  documentDate: string;
  status: 'posted' | 'reversed';
  sectionId?: string | null;
  locationId: string;
  pettyCashAmount?: string | null;
  subtotal: string;
  totalAmount: string;
  notes?: string | null;
  section?: OrdersV3Section | null;
  location: OrdersV3Location;
  lines: OrdersV3DocumentLine[];
};

export type OrdersV3Summary = {
  purchaseCount: number;
  registrationCount: number;
  purchaseTotal: string;
  registrationTotal: string;
  externalTotal: string;
  internalTotal: string;
  transferTotal: string;
  kernelVersion: 3;
};

export type OrdersV3ItemsReportRow = {
  itemId: string;
  nameAr: string;
  categoryName: string;
  baseUnit: string;
  documentCount: number;
  baseQuantity: string;
  totalAmount: string;
  averageUnitCost: string;
};

export type OrdersV3SalesReport = {
  kernelVersion: 3;
  summary: { count: number; totalAmount: string };
  byItem: OrdersV3ItemsReportRow[];
  bySection: Array<{ sectionId: string; sectionName: string; count: number; totalAmount: string }>;
  documents: OrdersV3Document[];
};

export type OrdersV3InventoryBalance = {
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
};

export type OrdersV3LedgerEntry = {
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
  item: OrdersV3Item;
  location: OrdersV3Location;
};

export type OrdersV3DataQuality = {
  kernelVersion: 3;
  itemCount: number;
  errorCount: number;
  warningCount: number;
  ready: boolean;
  issues: Array<{ code: string; severity: 'warning' | 'error'; itemId: string; itemName: string; message: string }>;
};

export type OrdersV3Stocktake = {
  id: string;
  stocktakeNumber: string;
  stocktakeDate: string;
  status: string;
  location: OrdersV3Location;
  lines: Array<{
    id: string;
    expectedQuantity: string;
    physicalQuantity: string;
    varianceQuantity: string;
    varianceValue: string;
    item: OrdersV3Item;
    unit: OrdersV3Unit;
  }>;
};

export type OrdersV3DocumentPayload = {
  documentType: 'purchase' | 'registration';
  documentDate: string;
  paymentMethod?: 'external' | 'internal' | 'transfer' | null;
  sectionId?: string | null;
  locationId: string;
  pettyCashAmount?: string | null;
  notes?: string | null;
  idempotencyKey: string;
  lines: Array<{ itemId: string; quantity: string; unitId: string; unitPrice?: string; priceUnitId?: string }>;
};
