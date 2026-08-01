import { Prisma } from '@prisma/client';
import { resolveQuantityMultiplierOrNull } from './orders-quantity-multiplier.util';

export type ProductVariantRow = {
  size?: string;
  packaging?: string;
  unit?: string;
  lastPrice?: string | number;
  quantityMultiplier?: string | number;
};

export type StaffItemVariantInput = {
  size?: string | null;
  packaging?: string | null;
  unit?: string | null;
  unitPrice?: string | null;
};

export class StaffItemConversionError extends Error {
  constructor(readonly unit: string) {
    super(`Missing inventory conversion for unit ${unit}`);
  }
}

function requireQuantityMultiplier(
  product: Parameters<typeof resolveQuantityMultiplierOrNull>[0],
  selection: Parameters<typeof resolveQuantityMultiplierOrNull>[1],
): Prisma.Decimal {
  const multiplier = resolveQuantityMultiplierOrNull(product, selection);
  if (!multiplier) throw new StaffItemConversionError(selection.unit?.trim() || product?.unit?.trim() || 'piece');
  return multiplier;
}

/** يطابق متغيراً من الكتالوج أو يعيد الافتراضي */
export function resolveStaffItemVariant(
  product: {
    lastPrice?: Prisma.Decimal | string | number | null;
    variants?: unknown;
    unit?: string | null;
    inventoryConversions?: unknown;
    conversionTemplate?: { conversions?: unknown } | null;
  } | null | undefined,
  input: StaffItemVariantInput,
): {
  size: string | null;
  packaging: string | null;
  unit: string | null;
  unitPrice: Prisma.Decimal;
  quantityMultiplier: Prisma.Decimal;
} {
  const size = input.size?.trim() || null;
  const packaging = input.packaging?.trim() || null;
  const unit = input.unit?.trim() || product?.unit?.trim() || 'piece';
  const variants = Array.isArray(product?.variants) ? (product!.variants as ProductVariantRow[]) : [];

  if (input.unitPrice != null && String(input.unitPrice).trim() !== '') {
    return {
      size,
      packaging,
      unit,
      unitPrice: new Prisma.Decimal(input.unitPrice),
      quantityMultiplier: requireQuantityMultiplier(product, { size, packaging, unit }),
    };
  }

  const match = variants.find(
    (v) => (v.size || '') === (size || '') && (v.packaging || '') === (packaging || '') && (v.unit || 'piece') === unit,
  );
  if (match?.lastPrice != null && String(match.lastPrice).trim() !== '') {
    return {
      size,
      packaging,
      unit,
      unitPrice: new Prisma.Decimal(match.lastPrice),
      quantityMultiplier: requireQuantityMultiplier(product, { size, packaging, unit }),
    };
  }
  if (variants.length > 0 && !size && !packaging) {
    const v0 = variants[0];
    return {
      size: v0.size?.trim() || null,
      packaging: v0.packaging?.trim() || null,
      unit: v0.unit?.trim() || 'piece',
      unitPrice: new Prisma.Decimal(v0.lastPrice ?? 0),
      quantityMultiplier: requireQuantityMultiplier(product, {
        size: v0.size,
        packaging: v0.packaging,
        unit: v0.unit,
      }),
    };
  }

  return {
    size,
    packaging,
    unit,
    unitPrice: new Prisma.Decimal(product?.lastPrice ?? 0),
    quantityMultiplier: requireQuantityMultiplier(product, { size, packaging, unit }),
  };
}

export function staffLineAggregateKey(
  productId: string,
  size: string | null,
  packaging: string | null,
  unit: string | null,
  unitPrice: Prisma.Decimal,
): string {
  return `${productId}|${size ?? ''}|${packaging ?? ''}|${unit ?? ''}|${unitPrice.toString()}`;
}

export function formatVariantLabel(
  size: string | null,
  packaging: string | null,
  unit: string | null,
): string {
  const parts = [size, packaging, unit].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '';
}
