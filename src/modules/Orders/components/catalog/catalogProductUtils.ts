import { fmt } from '../../../../utils/format';

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

export function productVariantsSummary(p: any): string {
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  if (variants.length > 0) {
    return variants
      .map((v: any) => `${v.size || '—'}/${v.packaging || '—'}/${v.unit || 'piece'}: ${fmt(v.lastPrice ?? 0)}`)
      .join(' | ');
  }
  if (p?.lastPrice != null && Number(p.lastPrice) > 0) return fmt(p.lastPrice);
  return '—';
}

/** ملخص سعر مختصر للجوال (سطر واحد) */
export function productPriceLineShort(p: any): string {
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  if (variants.length > 1) {
    const prices = variants
      .map((v: any) => parseFloat(v.lastPrice))
      .filter((n: number) => !Number.isNaN(n) && n > 0);
    if (prices.length > 0) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
    }
  }
  return productVariantsSummary(p);
}

export function productHasAdvancedVariants(p: any): boolean {
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  return variants.some((v: any) => v.size || v.packaging || parseFloat(v.lastPrice) > 0);
}
