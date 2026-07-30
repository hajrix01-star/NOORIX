import type { NamedDisplayRef } from './orders';

export type ShishaInventoryDailyRow = {
  date: string;
  operations: number;
  newShisha: number;
  changes: number;
  tobaccoHeadsConsumed: number;
  tobaccoConsumedKg: number;
  hosesConsumed: number;
  tobaccoPurchasedKg: number;
  tobaccoCorrectionKg: number;
  openingTobaccoKg: number;
  closingTobaccoKg: number;
  closingTobaccoHeads: number;
  openingHoses: number;
  closingHoses: number;
  openingCharcoalPieces: number;
  closingCharcoalPieces: number;
  charcoalPurchasedBoxes: number;
  charcoalConsumedBoxes: number;
  charcoalConsumedPieces: number;
  charcoalExpectedBoxes: number;
  charcoalActualBoxes: number | null;
  charcoalVarianceBoxes: number | null;
  charcoalStatus: 'legacy_expected' | 'missing_actual' | 'matched' | 'over' | 'under' | 'no_activity';
  openingCharcoalBoxes: number;
  closingCharcoalBoxes: number;
};

export type ShishaInventoryMovement = {
  id: string;
  transactionDate: string;
  movementType: 'opening' | 'purchase' | 'stocktake_adjustment';
  materialType: 'tobacco' | 'hose' | 'charcoal';
  quantityBase: number | string;
  costInclVat?: number | string | null;
  invoiceNumber?: string | null;
  supplierName?: string | null;
  notes?: string | null;
  createdAt: string;
  createdBy?: NamedDisplayRef | null;
};

export type ShishaStocktake = {
  id: string;
  stocktakeDate: string;
  status: 'approved';
  tobaccoVarianceGrams: number | string;
  hoseVariance: number | string;
  charcoalVariancePieces: number | string;
  createdAt: string;
  createdBy?: NamedDisplayRef | null;
};

export type ShishaInventorySummary = {
  initialized: boolean;
  startDate: string;
  endDate: string;
  settings?: {
    trackingStartDate: string;
    headsPerKg: number;
    gramsPerHead: number;
    charcoalPacksPerCarton: number;
    charcoalPiecesPerPack: number;
    charcoalShishaPerPack: number;
    charcoalActualTrackingStartDate: string | null;
    charcoalConsumptionProductId: string | null;
  };
  effectiveStart?: string;
  daily?: ShishaInventoryDailyRow[];
  current?: {
    tobaccoGrams: number;
    tobaccoKg: number;
    tobaccoHeads: number;
    hoses: number;
    charcoalPiecesTotal: number;
    charcoalBoxesTotal: number;
    charcoalCartons: number;
    charcoalPacks: number;
    charcoalPieces: number;
    averageCostPerGram: number | null;
    averageCostPerHead: number | null;
  };
  periodTotals?: {
    operations: number;
    newShisha: number;
    changes: number;
    tobaccoHeadsConsumed: number;
    tobaccoConsumedKg: number;
    hosesConsumed: number;
    tobaccoPurchasedKg: number;
    hosesPurchased: number;
    charcoalPiecesPurchased: number;
    charcoalBoxesPurchased: number;
    charcoalPiecesConsumed: number;
    charcoalBoxesConsumed: number;
    charcoalExpectedBoxes: number;
    charcoalActualBoxes: number;
    charcoalVarianceBoxes: number;
    charcoalMissingDays: number;
    charcoalAlertDays: number;
    tobaccoCorrectionKg: number;
  };
  latestStocktake?: ShishaStocktake | null;
  movements?: ShishaInventoryMovement[];
};

export type InitializeShishaInventoryPayload = {
  companyId: string;
  startDate: string;
  headsPerKg: string;
  tobaccoQuantity: string;
  tobaccoUnit: 'kg' | 'g';
  hoses: string;
  charcoalCartons: string;
  charcoalPacks: string;
  charcoalPieces: string;
  tobaccoCostInclVat?: string;
  hoseCostInclVat?: string;
  charcoalCostInclVat?: string;
  notes?: string;
};

export type CreateShishaPurchasePayload = {
  companyId: string;
  transactionDate: string;
  materialType: 'tobacco' | 'hose' | 'charcoal';
  quantity: string;
  unit: 'kg' | 'g' | 'piece' | 'pack' | 'carton';
  costInclVat?: string;
  invoiceNumber?: string;
  supplierName?: string;
  notes?: string;
};

export type CreateShishaPurchaseBatchPayload = {
  companyId: string;
  transactionDate: string;
  items: Array<{
    materialType: 'tobacco' | 'hose' | 'charcoal';
    quantity: string;
    unit: 'kg' | 'g' | 'piece' | 'pack';
    costInclVat?: string;
  }>;
  invoiceNumber?: string;
  supplierName?: string;
  notes?: string;
};

export type CreateShishaStocktakePayload = {
  companyId: string;
  stocktakeDate: string;
  tobaccoQuantity: string;
  tobaccoUnit: 'kg' | 'g';
  hoses: string;
  charcoalCartons: string;
  charcoalPacks: string;
  charcoalPieces: string;
  notes?: string;
};
