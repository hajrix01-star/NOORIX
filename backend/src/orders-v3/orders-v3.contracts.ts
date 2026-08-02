export type OrdersV3DocumentType = 'purchase' | 'registration';

export type OrdersV3UnitInput = {
  code: string;
  nameAr: string;
  nameEn?: string | null;
  dimension: string;
  canonicalFactor?: string | null;
  decimalScale?: number;
};

export type OrdersV3NamedInput = {
  nameAr: string;
  nameEn?: string | null;
  code?: string;
  sortOrder?: number;
};

export type OrdersV3ItemInput = {
  sku?: string | null;
  nameAr: string;
  nameEn?: string | null;
  itemType: 'purchased' | 'sale' | 'both';
  categoryId?: string | null;
  baseUnitId: string;
  sectionIds?: string[];
  trackInventory?: boolean;
  sortOrder?: number;
};

export type OrdersV3ConversionPublishInput = {
  itemId: string;
  edges: Array<{
    fromUnitId: string;
    toUnitId: string;
    factor: string;
    reversible?: boolean;
    allowDimensionBridge?: boolean;
  }>;
};

export type OrdersV3RecipePublishInput = {
  outputItemId: string;
  outputQuantity: string;
  outputUnitId: string;
  lines: Array<{
    componentItemId: string;
    quantity: string;
    unitId: string;
    wastePercent?: string;
  }>;
};

export type OrdersV3DocumentInput = {
  documentType: OrdersV3DocumentType;
  documentDate: string;
  paymentMethod?: 'external' | 'internal' | 'transfer' | null;
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
  }>;
};

export type OrdersV3StocktakeInput = {
  stocktakeDate: string;
  locationId: string;
  notes?: string | null;
  idempotencyKey: string;
  lines: Array<{ itemId: string; physicalQuantity: string }>;
};
