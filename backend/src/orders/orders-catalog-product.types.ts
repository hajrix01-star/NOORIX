export type ProductVariantInput = {
  size?: string;
  packaging?: string;
  unit?: string;
  lastPrice?: string;
  quantityMultiplier?: string;
};

export type ProductRecipeItemInput = {
  materialType?: string;
  materialProductId?: string;
  quantity?: string;
  unit?: string;
};
