export type OrdersV4LocalizedEntity = {
  nameAr: string;
  nameEn?: string | null;
};

/** One fallback policy for every Orders V4 entity name shown to the user. */
export function ordersV4LocalizedName(
  entity: OrdersV4LocalizedEntity | null | undefined,
  language: string,
  fallback = '—',
): string {
  if (!entity) return fallback;
  if (language === 'en') return entity.nameEn?.trim() || entity.nameAr || fallback;
  return entity.nameAr?.trim() || entity.nameEn?.trim() || fallback;
}
