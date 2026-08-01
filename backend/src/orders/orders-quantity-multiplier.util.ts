import { Prisma } from '@prisma/client';
import {
  normalizeUnit,
  resolveProductUnitMultiplierOrNull,
} from './orders-unit-conversions.util';

export type QuantityMultiplierVariant = {
  size?: string | null;
  packaging?: string | null;
  unit?: string | null;
  quantityMultiplier?: string | number | null;
};

type VariantSelection = {
  size?: string | null;
  packaging?: string | null;
  unit?: string | null;
};

type QuantityMultiplierProduct = {
  unit?: string | null;
  variants?: unknown;
  inventoryConversions?: unknown;
  conversionTemplate?: { conversions?: unknown } | null;
};

const ONE = new Prisma.Decimal(1);

function normalized(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

export function positiveQuantityMultiplier(
  value: string | number | Prisma.Decimal | null | undefined,
): Prisma.Decimal {
  if (value == null || String(value).trim() === '') return ONE;
  try {
    const multiplier = new Prisma.Decimal(value);
    return multiplier.gt(0) ? multiplier : ONE;
  } catch {
    return ONE;
  }
}

function positiveQuantityMultiplierOrNull(
  value: string | number | Prisma.Decimal | null | undefined,
): Prisma.Decimal | null {
  if (value == null || String(value).trim() === '') return null;
  try {
    const multiplier = new Prisma.Decimal(value);
    return multiplier.gt(0) ? multiplier : null;
  } catch {
    return null;
  }
}

function selectionConversionMultiplier(
  product: QuantityMultiplierProduct | null | undefined,
  packaging: string,
  unit: string,
  baseUnit: string,
): Prisma.Decimal | null {
  const candidates = [packaging, unit]
    .map((value) => normalized(value))
    .filter(Boolean)
    .map((value) => normalizeUnit(value, baseUnit));

  for (const candidate of [...new Set(candidates)]) {
    if (candidate === baseUnit) continue;
    const multiplier = resolveProductUnitMultiplierOrNull(
      product ?? {},
      candidate,
      baseUnit,
    );
    if (multiplier) return multiplier;
  }
  return null;
}

/** Resolve multipliers for new writes without guessing or silent fallbacks. */
export function resolveQuantityMultiplierOrNull(
  product: QuantityMultiplierProduct | null | undefined,
  selection: VariantSelection,
): Prisma.Decimal | null {
  const variants = Array.isArray(product?.variants)
    ? product.variants as QuantityMultiplierVariant[]
    : [];
  const size = normalized(selection.size);
  const packaging = normalized(selection.packaging);
  const baseUnit = normalizeUnit(product?.unit, 'piece');
  const unit = normalizeUnit(selection.unit, baseUnit);

  const conversionMultiplier = selectionConversionMultiplier(
    product,
    packaging,
    unit,
    baseUnit,
  );
  if (conversionMultiplier) return conversionMultiplier;

  const match = variants.find((variant) =>
    normalized(variant.size) === size
    && normalized(variant.packaging) === packaging
    && normalizeUnit(variant.unit, baseUnit) === unit,
  );
  const legacyMultiplier = match
    ? positiveQuantityMultiplierOrNull(match.quantityMultiplier)
    : null;
  if (legacyMultiplier) return legacyMultiplier;
  return unit === baseUnit && !size && !packaging ? ONE : null;
}

export function resolveQuantityMultiplier(
  product: QuantityMultiplierProduct | null | undefined,
  selection: VariantSelection,
): Prisma.Decimal {
  const variants = Array.isArray(product?.variants)
    ? product.variants as QuantityMultiplierVariant[]
    : [];
  const size = normalized(selection.size);
  const packaging = normalized(selection.packaging);
  const baseUnit = normalizeUnit(product?.unit, 'piece');
  const unit = normalizeUnit(selection.unit, baseUnit);
  const conversionMultiplier = selectionConversionMultiplier(
    product,
    packaging,
    unit,
    baseUnit,
  );
  if (conversionMultiplier) return conversionMultiplier;

  const match = variants.find((variant) =>
    normalized(variant.size) === size
    && normalized(variant.packaging) === packaging
    && normalizeUnit(variant.unit) === unit,
  );
  if (match) return positiveQuantityMultiplier(match.quantityMultiplier);
  if (unit === baseUnit && !size) return ONE;
  if (unit === 'half_pack') return new Prisma.Decimal('0.5');
  if (variants.length > 0 && !size && !packaging) {
    return positiveQuantityMultiplier(variants[0].quantityMultiplier);
  }
  return ONE;
}
