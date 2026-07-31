import { Prisma } from '@prisma/client';
import { normalizeUnit, resolveProductUnitMultiplierOrNull } from './orders-unit-conversions.util';

export class InventoryConsumptionSnapshotError extends Error {}

export type InventoryConsumptionSnapshotV1 = {
  version: 1;
  source: 'captured' | 'reversal' | 'legacy_estimated';
  soldBaseQuantity: string;
  components: Array<{
    materialProductId: string;
    materialBaseUnit: string;
    quantityBase: string;
  }>;
};

type ProductForConsumptionSnapshot = {
  id: string;
  nameAr?: string | null;
  productType?: string | null;
  unit?: string | null;
  recipe?: unknown;
  inventoryConversions?: unknown;
  conversionTemplate?: { conversions?: unknown } | null;
};

type RecipeRow = {
  materialProductId: string;
  quantity: Prisma.Decimal;
  unit: string;
};

function positiveDecimal(value: Prisma.Decimal | string | number, label: string): Prisma.Decimal {
  try {
    const parsed = new Prisma.Decimal(value);
    if (parsed.isFinite() && parsed.gt(0)) return parsed;
  } catch {
    // Converted below into one stable domain error.
  }
  throw new InventoryConsumptionSnapshotError(`${label} must be a positive decimal.`);
}

function parseRecipe(value: unknown): RecipeRow[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new InventoryConsumptionSnapshotError('Sale product recipe must be an array.');
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new InventoryConsumptionSnapshotError(`Recipe row ${index + 1} is invalid.`);
    }
    const row = entry as Record<string, unknown>;
    const materialProductId = String(row.materialProductId ?? '').trim();
    if (!materialProductId) {
      throw new InventoryConsumptionSnapshotError(`Recipe row ${index + 1} has no material product.`);
    }
    return {
      materialProductId,
      quantity: positiveDecimal(String(row.quantity ?? ''), `Recipe quantity for ${materialProductId}`),
      unit: normalizeUnit(row.unit, ''),
    };
  });
}

export function inventoryRecipeMaterialIds(recipe: unknown): string[] {
  return [...new Set(parseRecipe(recipe).map((row) => row.materialProductId))];
}

export function buildInventoryConsumptionSnapshot(input: {
  saleProduct: ProductForConsumptionSnapshot;
  soldQuantity: Prisma.Decimal | string | number;
  soldQuantityMultiplier: Prisma.Decimal | string | number;
  materialById: ReadonlyMap<string, ProductForConsumptionSnapshot>;
  source?: InventoryConsumptionSnapshotV1['source'];
  direction?: 1 | -1;
}): InventoryConsumptionSnapshotV1 {
  if (input.saleProduct.productType && input.saleProduct.productType !== 'sale') {
    throw new InventoryConsumptionSnapshotError('Inventory consumption can only be captured for sale products.');
  }
  const direction = input.direction ?? 1;
  const soldBaseQuantity = positiveDecimal(input.soldQuantity, 'Sold quantity')
    .times(positiveDecimal(input.soldQuantityMultiplier, 'Sold quantity multiplier'))
    .times(direction);
  const componentTotals = new Map<string, {
    materialProductId: string;
    materialBaseUnit: string;
    quantityBase: Prisma.Decimal;
  }>();

  for (const recipeRow of parseRecipe(input.saleProduct.recipe)) {
    const material = input.materialById.get(recipeRow.materialProductId);
    if (!material || (material.productType && material.productType !== 'order')) {
      throw new InventoryConsumptionSnapshotError(
        `Recipe material "${recipeRow.materialProductId}" is missing or is not an inventory product.`,
      );
    }
    const recipeUnit = normalizeUnit(recipeRow.unit, material.unit || 'piece');
    const materialBaseUnit = normalizeUnit(material.unit, recipeUnit);
    const conversionMultiplier = resolveProductUnitMultiplierOrNull(
      material,
      recipeUnit,
      materialBaseUnit,
    );
    if (!conversionMultiplier) {
      throw new InventoryConsumptionSnapshotError(
        `Missing inventory conversion for material "${material.nameAr || material.id}" from "${recipeUnit}" to "${materialBaseUnit}".`,
      );
    }
    const key = `${material.id}|${materialBaseUnit}`;
    const current = componentTotals.get(key);
    const quantityBase = soldBaseQuantity.times(recipeRow.quantity).times(conversionMultiplier);
    componentTotals.set(key, {
      materialProductId: material.id,
      materialBaseUnit,
      quantityBase: (current?.quantityBase ?? new Prisma.Decimal(0)).plus(quantityBase),
    });
  }

  return {
    version: 1,
    source: input.source ?? 'captured',
    soldBaseQuantity: soldBaseQuantity.toString(),
    components: [...componentTotals.values()].map((component) => ({
      materialProductId: component.materialProductId,
      materialBaseUnit: component.materialBaseUnit,
      quantityBase: component.quantityBase.toString(),
    })),
  };
}

export function parseInventoryConsumptionSnapshot(value: unknown): InventoryConsumptionSnapshotV1 | null {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InventoryConsumptionSnapshotError('Stored inventory consumption snapshot is invalid.');
  }
  const row = value as Record<string, unknown>;
  if (row.version !== 1 || !Array.isArray(row.components)) {
    throw new InventoryConsumptionSnapshotError('Stored inventory consumption snapshot version is unsupported.');
  }
  const soldBaseQuantity = new Prisma.Decimal(String(row.soldBaseQuantity ?? ''));
  if (!soldBaseQuantity.isFinite()) {
    throw new InventoryConsumptionSnapshotError('Stored sold base quantity is invalid.');
  }
  const components = row.components.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new InventoryConsumptionSnapshotError('Stored inventory component is invalid.');
    }
    const component = entry as Record<string, unknown>;
    const materialProductId = String(component.materialProductId ?? '').trim();
    const materialBaseUnit = String(component.materialBaseUnit ?? '').trim();
    const quantityBase = new Prisma.Decimal(String(component.quantityBase ?? ''));
    if (!materialProductId || !materialBaseUnit || !quantityBase.isFinite()) {
      throw new InventoryConsumptionSnapshotError('Stored inventory component is incomplete.');
    }
    return { materialProductId, materialBaseUnit, quantityBase: quantityBase.toString() };
  });
  const source = row.source === 'reversal' || row.source === 'legacy_estimated'
    ? row.source
    : 'captured';
  return { version: 1, source, soldBaseQuantity: soldBaseQuantity.toString(), components };
}

export function buildCancellationConsumptionSnapshot(input: {
  requestedSoldBaseQuantity: Prisma.Decimal | string | number;
  recordedSnapshots: readonly unknown[];
  estimatedCurrentSnapshot: InventoryConsumptionSnapshotV1;
}): InventoryConsumptionSnapshotV1 {
  const requested = positiveDecimal(input.requestedSoldBaseQuantity, 'Cancelled sold quantity');
  const parsed = input.recordedSnapshots.map(parseInventoryConsumptionSnapshot);
  if (parsed.length === 0 || parsed.some((snapshot) => snapshot == null)) {
    return {
      ...input.estimatedCurrentSnapshot,
      source: 'legacy_estimated',
      soldBaseQuantity: requested.negated().toString(),
      components: input.estimatedCurrentSnapshot.components.map((component) => ({
        ...component,
        quantityBase: new Prisma.Decimal(component.quantityBase).negated().toString(),
      })),
    };
  }

  const snapshots = parsed.filter((snapshot): snapshot is InventoryConsumptionSnapshotV1 => snapshot != null);
  const remainingSoldBase = snapshots.reduce(
    (sum, snapshot) => sum.plus(snapshot.soldBaseQuantity),
    new Prisma.Decimal(0),
  );
  if (!remainingSoldBase.isFinite() || remainingSoldBase.lte(0) || requested.gt(remainingSoldBase)) {
    throw new InventoryConsumptionSnapshotError('Cancellation exceeds snapshotted remaining sold quantity.');
  }
  const componentTotals = new Map<string, {
    materialProductId: string;
    materialBaseUnit: string;
    quantityBase: Prisma.Decimal;
  }>();
  for (const snapshot of snapshots) {
    for (const component of snapshot.components) {
      const key = `${component.materialProductId}|${component.materialBaseUnit}`;
      const current = componentTotals.get(key);
      componentTotals.set(key, {
        materialProductId: component.materialProductId,
        materialBaseUnit: component.materialBaseUnit,
        quantityBase: (current?.quantityBase ?? new Prisma.Decimal(0)).plus(component.quantityBase),
      });
    }
  }
  const ratio = requested.div(remainingSoldBase).negated();
  return {
    version: 1,
    source: 'reversal',
    soldBaseQuantity: requested.negated().toString(),
    components: [...componentTotals.values()].map((component) => ({
      materialProductId: component.materialProductId,
      materialBaseUnit: component.materialBaseUnit,
      quantityBase: component.quantityBase.times(ratio).toString(),
    })),
  };
}

export function inventoryConsumptionSnapshotJson(
  snapshot: InventoryConsumptionSnapshotV1,
): Prisma.InputJsonObject {
  return {
    version: snapshot.version,
    source: snapshot.source,
    soldBaseQuantity: snapshot.soldBaseQuantity,
    components: snapshot.components.map((component) => ({ ...component })),
  };
}
