import { describe, expect, it } from 'vitest';
import {
  expandProductsToPrintRows,
  filterProductsForCatalogPrint,
  groupProductsByCategory,
  sortProductsForCatalogPrint,
} from './itemsCatalogPrint';

const unitLabel = (u: string) => u;

describe('filterProductsForCatalogPrint', () => {
  const products = [
    { id: '1', nameAr: 'ب', productType: 'order', categoryId: 'c1', sections: ['مطبخ'] },
    { id: '2', nameAr: 'أ', productType: 'order', categoryId: 'c2', sections: ['بار'] },
    { id: '3', nameAr: 'ج', productType: 'sale', categoryId: 'c1', sections: ['مطبخ'] },
    { id: '4', nameAr: 'د', productType: 'order', categoryId: 'c1', sections: [] },
  ];

  it('filters by product type', () => {
    const result = filterProductsForCatalogPrint(products, {
      section: '',
      categoryId: '',
      productType: 'order',
    });
    expect(result.map((p) => p.id)).toEqual(['2', '1', '4']);
  });

  it('filters by section and category', () => {
    const result = filterProductsForCatalogPrint(products, {
      section: 'مطبخ',
      categoryId: 'c1',
      productType: 'order',
    });
    expect(result.map((p) => p.id)).toEqual(['1']);
  });

  it('filters products without section', () => {
    const result = filterProductsForCatalogPrint(products, {
      section: '__none__',
      categoryId: '',
      productType: 'order',
    });
    expect(result.map((p) => p.id)).toEqual(['4']);
  });
});

describe('groupProductsByCategory', () => {
  it('groups and orders categories by sortOrder then product name', () => {
    const categories = [
      { id: 'c1', nameAr: 'لحوم', sortOrder: 2 },
      { id: 'c2', nameAr: 'خضروات', sortOrder: 1 },
    ];
    const products = [
      { id: '1', nameAr: 'ب', categoryId: 'c1' },
      { id: '2', nameAr: 'أ', categoryId: 'c2' },
      { id: '3', nameAr: 'ج', categoryId: 'c2' },
      { id: '4', nameAr: 'د', categoryId: null },
    ];

    const groups = groupProductsByCategory(products, categories, 'بدون فئة');

    expect(groups.map((g) => g.categoryName)).toEqual(['خضروات', 'لحوم', 'بدون فئة']);
    expect(groups[0].products.map((p) => p.id)).toEqual(['2', '3']);
    expect(groups[1].products.map((p) => p.id)).toEqual(['1']);
    expect(groups[2].products.map((p) => p.id)).toEqual(['4']);
  });
});

describe('sortProductsForCatalogPrint', () => {
  it('sorts products within the same category alphabetically', () => {
    const sorted = sortProductsForCatalogPrint(
      [
        { nameAr: 'تفاح', categoryId: 'c1' },
        { nameAr: 'أناناس', categoryId: 'c1' },
      ],
      [{ id: 'c1', nameAr: 'فواكه', sortOrder: 0 }],
    );

    expect(sorted.map((p) => p.nameAr)).toEqual(['أناناس', 'تفاح']);
  });
});

describe('expandProductsToPrintRows', () => {
  it('expands variants into separate rows', () => {
    const rows = expandProductsToPrintRows(
      [
        {
          nameAr: 'دجاج',
          nameEn: 'Chicken',
          category: { nameAr: 'لحوم' },
          variants: [
            { size: 'صغير', packaging: 'كيس', unit: 'kg' },
            { size: 'كبير', packaging: 'كرتون', unit: 'box' },
          ],
        },
      ],
      unitLabel,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].nameAr).toBe('دجاج');
    expect(rows[1].nameAr).toBe('');
    expect(rows[1].size).toBe('كبير');
  });
});
