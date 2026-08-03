import type { OrdersV4ReportFacets } from '../../../types/api';

export function ordersV4ReportFacetOptions(
  facets: OrdersV4ReportFacets | undefined,
  documentType: 'purchase' | 'registration' | '',
  sectionIds: string[],
  categoryIds: string[],
) {
  const itemType = documentType === 'purchase' ? 'purchased' : documentType === 'registration' ? 'sale' : '';
  const typedItems = (facets?.items ?? []).filter((item) => !itemType || item.itemType === itemType);
  const sections = (facets?.sections ?? []).filter((section) => typedItems.some((item) => item.sectionIds.includes(section.id)));
  const categories = (facets?.categories ?? []).filter((category) => typedItems.some((item) => item.categoryId === category.id
    && (!sectionIds.length || item.sectionIds.some((id) => sectionIds.includes(id)))));
  const items = typedItems.filter((item) => (!sectionIds.length || item.sectionIds.some((id) => sectionIds.includes(id)))
    && (!categoryIds.length || (item.categoryId && categoryIds.includes(item.categoryId))));
  return { sections, categories, items };
}
