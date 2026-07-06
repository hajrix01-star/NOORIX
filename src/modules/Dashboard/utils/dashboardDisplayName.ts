import type { DashboardNamedEntity } from '../../../types/api/domains/dashboard';

export function dashboardDisplayName(
  source: DashboardNamedEntity | null | undefined,
  lang: string,
  fallback = '',
): string {
  if (!source) return fallback;
  if (lang === 'en') {
    return source.nameEn || source.name || source.nameAr || fallback;
  }
  return source.nameAr || source.name || source.nameEn || fallback;
}
