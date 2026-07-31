import { Prisma } from '@prisma/client';

export const INVENTORY_RECORD_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const INVENTORY_QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;

const MAX_INVENTORY_QUANTITY = new Prisma.Decimal('999999999999.999999');

export class InventoryStocktakeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryStocktakeValidationError';
  }
}

export type StocktakeQuantityInput = {
  productId: string;
  unit: string;
  expectedQuantity: Prisma.Decimal | string | number;
  physicalQuantity: Prisma.Decimal | string | number;
};

export type StocktakeQuantityResult = {
  productId: string;
  unit: string;
  expectedQuantity: Prisma.Decimal;
  physicalQuantity: Prisma.Decimal;
  varianceQuantity: Prisma.Decimal;
};

export function assertCurrentSaudiStocktakeDate(value: unknown, todayYmd: string): string {
  const date = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date !== todayYmd) {
    throw new InventoryStocktakeValidationError('Inventory stocktake date must be the current Saudi date.');
  }
  return date;
}

function inventoryDecimal(
  value: Prisma.Decimal | string | number,
  field: string,
  productId: string,
  roundToStorageScale = false,
) {
  let quantity: Prisma.Decimal;
  try {
    quantity = new Prisma.Decimal(value);
  } catch {
    throw new InventoryStocktakeValidationError(`Invalid ${field} for product: ${productId}`);
  }
  if (!quantity.isFinite() || (!roundToStorageScale && quantity.decimalPlaces() > 6)) {
    throw new InventoryStocktakeValidationError(`Invalid ${field} precision for product: ${productId}`);
  }
  const storedQuantity = roundToStorageScale ? quantity.toDecimalPlaces(6) : quantity;
  if (storedQuantity.abs().gt(MAX_INVENTORY_QUANTITY)) {
    throw new InventoryStocktakeValidationError(`Invalid ${field} precision for product: ${productId}`);
  }
  return storedQuantity;
}

export function calculateStocktakeLines(
  lines: readonly StocktakeQuantityInput[],
): StocktakeQuantityResult[] {
  const seen = new Set<string>();
  return lines.map((line) => {
    const productId = String(line.productId ?? '').trim();
    if (!INVENTORY_RECORD_ID_PATTERN.test(productId)) {
      throw new InventoryStocktakeValidationError('Stocktake product id is invalid.');
    }
    if (seen.has(productId)) {
      throw new InventoryStocktakeValidationError(`Duplicate stocktake product: ${productId}`);
    }
    seen.add(productId);

    const expectedQuantity = inventoryDecimal(line.expectedQuantity, 'expected stock quantity', productId, true);
    const physicalQuantity = inventoryDecimal(line.physicalQuantity, 'physical stock quantity', productId);
    if (physicalQuantity.isNegative()) {
      throw new InventoryStocktakeValidationError(`Invalid physical stock quantity for product: ${productId}`);
    }

    return {
      productId,
      unit: String(line.unit || 'piece').trim() || 'piece',
      expectedQuantity,
      physicalQuantity,
      varianceQuantity: physicalQuantity.minus(expectedQuantity),
    };
  });
}
