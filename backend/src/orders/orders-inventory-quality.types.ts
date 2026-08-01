export type InventoryDataQualityStatus = 'verified' | 'needs_review';

export type InventoryDataQualityReport = {
  status: InventoryDataQualityStatus;
  checkedAt: string;
  legacy: {
    shishaSettingsRows: number;
    shishaMovementRows: number;
    shishaStocktakeRows: number;
    shishaTotalRows: number;
    purchaseItemsWithoutSnapshot: number;
  };
  estimated: {
    saleItemsFromCurrentRecipe: number;
  };
  snapshots: {
    purchases: {
      totalItems: number;
      verifiedItems: number;
      missingItems: number;
    };
    consumption: {
      totalItems: number;
      verifiedItems: number;
      missingItems: number;
      invalidItems: number;
    };
  };
};
