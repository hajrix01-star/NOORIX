/**
 * عرض أسماء أصناف/فئات الطلبات حسب لغة الواجهة (ar → عربي أولاً، غير ذلك → إنجليزي أولاً).
 */
export function orderLocalizedName(
  nameAr?: string | null,
  nameEn?: string | null,
  lang?: string,
): string {
  const ar = String(nameAr ?? '').trim();
  const en = String(nameEn ?? '').trim();
  const isAr = (lang || 'ar') === 'ar';
  if (isAr) return ar || en || '—';
  return en || ar || '—';
}

export function orderProductDisplayName(
  p: { nameAr?: string | null; nameEn?: string | null } | null | undefined,
  lang: string,
): string {
  if (!p) return '—';
  return orderLocalizedName(p.nameAr, p.nameEn, lang);
}
