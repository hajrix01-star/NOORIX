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

function selectionConversionMultiplier(
  product: QuantityMultiplierProduct | null | undefined,
  unit: string,
  baseUnit: string,
): Prisma.Decimal | null {
  if (unit === baseUnit) return null;
  return resolveProductUnitMultiplierOrNull(
    product ?? {},
    unit,
    baseUnit,
  );
}

/** Resolve current order writes from configured unit conversions only. */
export function resolveQuantityMultiplierOrNull(
  product: QuantityMultiplierProduct | null | undefined,
  selection: VariantSelection,
): Prisma.Decimal | null {
  const baseUnit = normalizeUnit(product?.unit, 'piece');
  const unit = normalizeUnit(selection.unit, baseUnit);
  if (unit === baseUnit) return ONE;
  return selectionConversionMultiplier(product, unit, baseUnit);
}

/** Compatibility reader for historical variant quantity multipliers. */
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
    unit,
    baseUnit,
  );
  if (conversionMultiplier) return conversionMultiplier;

  const match = variants.find((variant) =>
    normalized(variant.size) === size
    && normalized(variant.packaging) === packaging
    && normalizeUnit(variant.unit, baseUnit) === unit,
  );
  if (match) return positiveQuantityMultiplier(match.quantityMultiplier);
  if (unit === baseUnit && !size) return ONE;
  if (unit === 'half_pack') return new Prisma.Decimal('0.5');
  if (variants.length > 0 && !size && !packaging) {
    return positiveQuantityMultiplier(variants[0].quantityMultiplier);
  }
  return ONE;
}
