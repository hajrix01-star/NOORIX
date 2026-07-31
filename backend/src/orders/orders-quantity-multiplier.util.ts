import { Prisma } from '@prisma/client';
import { resolveProductUnitMultiplier } from './orders-unit-conversions.util';

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

export function resolveQuantityMultiplier(
  product: {
    unit?: string | null;
    variants?: unknown;
    inventoryConversions?: unknown;
    conversionTemplate?: { conversions?: unknown } | null;
  } | null | undefined,
  selection: VariantSelection,
): Prisma.Decimal {
  const variants = Array.isArray(product?.variants)
    ? product.variants as QuantityMultiplierVariant[]
    : [];
  const size = normalized(selection.size);
  const packaging = normalized(selection.packaging);
  const unit = normalized(selection.unit) || 'piece';
  const match = variants.find((variant) =>
    normalized(variant.size) === size
    && normalized(variant.packaging) === packaging
    && (normalized(variant.unit) || 'piece') === unit,
  );
  if (match) return positiveQuantityMultiplier(match.quantityMultiplier);
  if (unit === 'half_pack') return new Prisma.Decimal('0.5');
  const unitMultiplier = resolveProductUnitMultiplier(product ?? {}, unit, product?.unit ?? 'piece');
  if (!unitMultiplier.equals(ONE)) return unitMultiplier;
  if (variants.length > 0 && !size && !packaging) {
    return positiveQuantityMultiplier(variants[0].quantityMultiplier);
  }
  return ONE;
}
