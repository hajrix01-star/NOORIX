import { fmt } from '../../../../utils/format';
import type { OrderProduct, OrderProductVariant } from '../../../../types/api';

/** يفصل الاسم عن العلامة/الشركة إن وُجدت بين قوسين — مثل: Vanilla Ice Cream (Saudia) */
export function parseProductDisplayNames(row: { nameAr?: string | null; nameEn?: string | null }) {
  const splitParen = (raw: string) => {
    const s = raw.trim();
    if (!s) return { main: '', brand: null as string | null };
    const m = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (m) return { main: m[1].trim(), brand: m[2].trim() };
    return { main: s, brand: null };
  };

  const ar = splitParen(String(row.nameAr ?? ''));
  const en = splitParen(String(row.nameEn ?? ''));
  const brand = en.brand || ar.brand;
  const nameAr = ar.main || '—';
  const nameEn = en.main || null;

  return {
    nameAr,
    nameEn,
    brand,
  };
}

export function productVariantsSummary(
  p: OrderProduct,
  unitLabel: (unit: string) => string = (unit) => unit,
): string {
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  if (variants.length > 0) {
    return variants
      .map((v: OrderProductVariant) => {
        const parts = [
          v.size,
          v.packaging,
          unitLabel(v.unit || 'piece'),
        ].filter((value, index, values) => (
          value
          && value !== '—'
          && values.findIndex((candidate) => String(candidate).trim() === String(value).trim()) === index
        ));
        const multiplier = Number(v.quantityMultiplier ?? 1);
        if (Number.isFinite(multiplier) && multiplier !== 1) {
          parts.push(`×${fmt(multiplier, 2)}`);
        }
        return parts.join(' / ') || unitLabel('piece');
      })
      .join(' · ');
  }
  return unitLabel(p.unit || 'piece') || '—';
}

/** السعر فقط، دون خلطه بالحجم أو التغليف أو الوحدة. */
export function productPriceLineShort(p: OrderProduct): string {
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  const prices = variants
    .map((v: OrderProductVariant) => Number.parseFloat(String(v.lastPrice ?? '')))
    .filter((n: number) => Number.isFinite(n) && n > 0);

  if (prices.length > 0) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? fmt(min, 2) : `${fmt(min, 2)} – ${fmt(max, 2)}`;
  }

  const simplePrice = Number.parseFloat(String(p?.lastPrice ?? ''));
  return Number.isFinite(simplePrice) && simplePrice > 0 ? fmt(simplePrice, 2) : '—';
}

export function productHasAdvancedVariants(p: { variants?: OrderProductVariant[] | unknown }): boolean {
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  return variants.some((v: OrderProductVariant) =>
    v.size
    || v.packaging
    || Number.parseFloat(String(v.quantityMultiplier ?? '1')) !== 1
    || Number.parseFloat(String(v.lastPrice ?? '')) > 0
  );
}
