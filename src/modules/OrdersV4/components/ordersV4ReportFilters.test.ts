import { describe, expect, it } from 'vitest';
import type { OrdersV4ReportFacets } from '../../../types/api';
import { ordersV4ReportFacetOptions } from './ordersV4ReportFilters';

const facets: OrdersV4ReportFacets = {
  sections: [{ id: 'bar', code: 'bar', nameAr: 'بار' }, { id: 'kitchen', code: 'kitchen', nameAr: 'مطبخ' }],
  categories: [{ id: 'drinks', nameAr: 'مشروبات' }, { id: 'food', nameAr: 'طعام' }],
  items: [
    { id: 'cola', nameAr: 'كولا', itemType: 'sale', categoryId: 'drinks', sectionIds: ['bar'] },
    { id: 'meal', nameAr: 'وجبة', itemType: 'sale', categoryId: 'food', sectionIds: ['kitchen'] },
    { id: 'sugar', nameAr: 'سكر', itemType: 'purchased', categoryId: 'food', sectionIds: ['bar', 'kitchen'] },
  ],
  units: [],
};

describe('Orders V4 report facet cascade', () => {
  it('cascades section to categories and categories to items by stable identifiers', () => {
    const sectionScope = ordersV4ReportFacetOptions(facets, 'registration', ['bar'], []);
    expect(sectionScope.categories.map((entry) => entry.id)).toEqual(['drinks']);
    expect(sectionScope.items.map((entry) => entry.id)).toEqual(['cola']);

    const categoryScope = ordersV4ReportFacetOptions(facets, 'registration', [], ['food']);
    expect(categoryScope.items.map((entry) => entry.id)).toEqual(['meal']);
  });

  it('keeps purchase and registration catalogs isolated', () => {
    expect(ordersV4ReportFacetOptions(facets, 'purchase', [], []).items.map((entry) => entry.id)).toEqual(['sugar']);
    expect(ordersV4ReportFacetOptions(facets, 'registration', [], []).items.map((entry) => entry.id)).toEqual(['cola', 'meal']);
  });
});
