import { fmt } from '../../../../utils/format';

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

export function productHasAdvancedVariants(p: any): boolean {
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  return variants.some((v: any) => v.size || v.packaging || parseFloat(v.lastPrice) > 0);
}
