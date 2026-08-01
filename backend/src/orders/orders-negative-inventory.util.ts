import { Prisma } from '@prisma/client';
import { parseInventoryConsumptionSnapshot } from './orders-inventory-consumption-snapshot.util';

export type InventoryProjectionRow = {
  productId: string;
  productNameAr: string;
  productNameEn: string | null;
  unit: string;
  balanceBaseQuantity: string;
};

export type NegativeInventoryShortage = {
  productId: string;
  productNameAr: string;
  productNameEn: string | null;
  unit: string;
  availableQuantity: string;
  requestedQuantity: string;
  projectedQuantity: string;
};

export function findNegativeInventoryShortages(
  stock: readonly InventoryProjectionRow[],
  consumptionSnapshots: readonly unknown[],
): NegativeInventoryShortage[] {
  const demandByProductId = new Map<string, Prisma.Decimal>();

  for (const value of consumptionSnapshots) {
    const snapshot = parseInventoryConsumptionSnapshot(value);
    if (!snapshot) continue;
    for (const component of snapshot.components) {
      const quantity = new Prisma.Decimal(component.quantityBase);
      demandByProductId.set(
        component.materialProductId,
        (demandByProductId.get(component.materialProductId) ?? new Prisma.Decimal(0)).plus(quantity),
      );
    }
  }

  const stockByProductId = new Map(stock.map((row) => [row.productId, row]));
  const shortages: NegativeInventoryShortage[] = [];
  for (const [productId, requested] of demandByProductId) {
    if (requested.lte(0)) continue;
    const row = stockByProductId.get(productId);
    const available = new Prisma.Decimal(row?.balanceBaseQuantity ?? 0);
    const projected = available.minus(requested);
    if (projected.gte(0)) continue;
    shortages.push({
      productId,
      productNameAr: row?.productNameAr ?? productId,
      productNameEn: row?.productNameEn ?? null,
      unit: row?.unit ?? 'piece',
      availableQuantity: available.toString(),
      requestedQuantity: requested.toString(),
      projectedQuantity: projected.toString(),
    });
  }

  return shortages.sort((a, b) => a.productNameAr.localeCompare(b.productNameAr, 'ar'));
}
