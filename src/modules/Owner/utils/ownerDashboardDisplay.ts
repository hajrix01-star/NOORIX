import type { OwnerCompanySeries } from '../types';
import type { OwnerOverviewCompany } from '../../../types/api';
import type { OwnerOverviewMetric } from '../../../types/api';

export const MONTH_NAMES_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export const OWNER_METRICS: OwnerOverviewMetric[] = ['sales', 'purchases', 'expenses', 'netProfit'];

export function ownerCompanyName(
  company: { nameAr?: string | null; nameEn?: string | null } | undefined,
  lang: string,
  fallback: string,
) {
  if (!company) return fallback;
  return lang === 'ar'
    ? company.nameAr || company.nameEn || fallback
    : company.nameEn || company.nameAr || fallback;
}

export function buildOwnerCompanySeries(
  companies: OwnerOverviewCompany[],
  lang: string,
  colors: readonly string[],
): OwnerCompanySeries[] {
  return companies.map((company, index) => ({
    key: company.id,
    label: ownerCompanyName(company, lang, company.id),
    color: colors[index % colors.length],
  }));
}
