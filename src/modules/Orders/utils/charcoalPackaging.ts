import Decimal from 'decimal.js';
import type { OrderProduct, OrderProductVariant } from '../../../types/api';

export type CharcoalPackagingPreset = {
  packaging: string;
  unit: 'pack' | 'carton';
  quantityMultiplier: string;
  boxes: number;
  pieces: number;
};

export const CHARCOAL_PACKAGING_PRESETS: CharcoalPackagingPreset[] = [
  { packaging: 'ربع علبة', unit: 'pack', quantityMultiplier: '0.25', boxes: 0.25, pieces: 16 },
  { packaging: 'نصف علبة', unit: 'pack', quantityMultiplier: '0.5', boxes: 0.5, pieces: 32 },
  { packaging: 'علبة', unit: 'pack', quantityMultiplier: '1', boxes: 1, pieces: 64 },
  { packaging: 'علبة ونصف', unit: 'pack', quantityMultiplier: '1.5', boxes: 1.5, pieces: 96 },
  { packaging: 'ربع كرتون', unit: 'carton', quantityMultiplier: '2.5', boxes: 2.5, pieces: 160 },
  { packaging: 'نصف كرتون', unit: 'carton', quantityMultiplier: '5', boxes: 5, pieces: 320 },
  { packaging: 'كرتون', unit: 'carton', quantityMultiplier: '10', boxes: 10, pieces: 640 },
  { packaging: 'كرتون ونصف', unit: 'carton', quantityMultiplier: '15', boxes: 15, pieces: 960 },
];

export function isCharcoalCatalogProduct(
  product: Pick<OrderProduct, 'nameAr' | 'nameEn'> | { nameAr?: string | null; nameEn?: string | null },
): boolean {
  const arabicName = String(product.nameAr ?? '').trim();
  const englishName = String(product.nameEn ?? '').trim().toLowerCase();
  return arabicName.includes('فحم') || englishName.includes('charcoal');
}

export function charcoalPresetForPackaging(packaging?: string | null) {
  const normalized = String(packaging ?? '').trim();
  return CHARCOAL_PACKAGING_PRESETS.find((preset) => preset.packaging === normalized) ?? null;
}

function cartonPriceFromVariants(variants: OrderProductVariant[]): Decimal {
  const carton = variants.find((variant) =>
    ['كرتون', 'كرتن', 'carton'].includes(String(variant.packaging ?? '').trim().toLowerCase())
  );
  try {
    return new Decimal(carton?.lastPrice || 0);
  } catch {
    return new Decimal(0);
  }
}

export function buildStandardCharcoalVariants(
  existing: OrderProductVariant[],
  derivePrices: boolean,
): OrderProductVariant[] {
  const cartonPrice = derivePrices ? cartonPriceFromVariants(existing) : new Decimal(0);
  return CHARCOAL_PACKAGING_PRESETS.map((preset) => {
    const current = existing.find((variant) =>
      String(variant.packaging ?? '').trim() === preset.packaging
      || String(variant.quantityMultiplier ?? '').trim() === preset.quantityMultiplier
    );
    const derivedPrice = cartonPrice.times(preset.boxes).div(10).toDecimalPlaces(4).toString();
    return {
      size: '',
      packaging: preset.packaging,
      unit: preset.unit,
      quantityMultiplier: preset.quantityMultiplier,
      lastPrice: String(current?.lastPrice ?? (derivePrices ? derivedPrice : '0')),
    };
  });
}

export function charcoalConversionLabel(variant: Pick<OrderProductVariant, 'packaging' | 'quantityMultiplier'>): string {
  const preset = charcoalPresetForPackaging(variant.packaging);
  const boxes = preset?.boxes ?? Number(variant.quantityMultiplier ?? 1);
  const pieces = preset?.pieces ?? boxes * 64;
  return `${boxes} علبة = ${pieces} حبة`;
}

export function charcoalVariantLabel(variant: OrderProductVariant): string {
  const packaging = String(variant.packaging ?? '').trim() || 'فحم';
  return `${packaging} (${charcoalConversionLabel(variant)})`;
}

export function withStandardCharcoalVariants(product: OrderProduct): OrderProduct {
  if (!isCharcoalCatalogProduct(product)) return product;
  const existing = Array.isArray(product.variants) ? product.variants : [];
  const complete = CHARCOAL_PACKAGING_PRESETS.every((preset) =>
    existing.some((variant) =>
      String(variant.packaging ?? '').trim() === preset.packaging
      && String(variant.quantityMultiplier ?? '').trim() === preset.quantityMultiplier
    )
  );
  if (complete) return product;
  return {
    ...product,
    variants: buildStandardCharcoalVariants(existing, product.productType === 'order'),
  };
}
