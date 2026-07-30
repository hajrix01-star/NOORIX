import { describe, expect, it } from 'vitest';
import {
  buildItemsCatalogPdfFilename,
  expandProductsToPrintRows,
  filterProductsForCatalogPrint,
  groupProductsByCategory,
  sortProductsForCatalogPrint,
} from './itemsCatalogPrint';
import type { OrderCategory, OrderProduct, OrderSection } from '../../../types/api';

const unitLabel = (unit: string) => unit;

describe('filterProductsForCatalogPrint', () => {
  const products: OrderProduct[] = [
    { id: '1', nameAr: 'B', productType: 'order', categoryId: 'c1', sections: ['kitchen'] },
    { id: '2', nameAr: 'A', productType: 'order', categoryId: 'c2', sections: ['bar'] },
    { id: '3', nameAr: 'C', productType: 'sale', categoryId: 'c1', sections: ['kitchen'] },
    { id: '4', nameAr: 'D', productType: 'order', categoryId: 'c1', sections: [] },
  ];

  it('filters by product type', () => {
    const result = filterProductsForCatalogPrint(products, {
      section: '',
      categoryId: '',
      productType: 'order',
    });
    expect(result.map((product) => product.id)).toEqual(['2', '1', '4']);
  });

  it('filters by section and category', () => {
    const result = filterProductsForCatalogPrint(products, {
      section: 'kitchen',
      categoryId: 'c1',
      productType: 'order',
    });
    expect(result.map((product) => product.id)).toEqual(['1']);
  });

  it('filters products without section', () => {
    const result = filterProductsForCatalogPrint(products, {
      section: '__none__',
      categoryId: '',
      productType: 'order',
    });
    expect(result.map((product) => product.id)).toEqual(['4']);
  });

  it('filters uncategorized products and applies free-text search', () => {
    const result = filterProductsForCatalogPrint(
      [...products, { id: '5', nameAr: 'فحم كرتون', productType: 'order', categoryId: null, sections: ['shisha'] }],
      {
        section: '',
        categoryId: '__none__',
        productType: 'order',
        search: 'فحم',
      },
    );
    expect(result.map((product) => product.id)).toEqual(['5']);
  });
});

describe('groupProductsByCategory', () => {
  it('groups and orders categories by sortOrder then product name', () => {
    const categories: OrderCategory[] = [
      { id: 'c1', nameAr: 'Meat', sortOrder: 2 },
      { id: 'c2', nameAr: 'Vegetables', sortOrder: 1 },
    ];
    const products: OrderProduct[] = [
      { id: '1', nameAr: 'B', categoryId: 'c1' },
      { id: '2', nameAr: 'A', categoryId: 'c2' },
      { id: '3', nameAr: 'C', categoryId: 'c2' },
      { id: '4', nameAr: 'D', categoryId: null },
    ];

    const groups = groupProductsByCategory(products, categories, 'No category');

    expect(groups.map((group) => group.categoryName)).toEqual(['Vegetables', 'Meat', 'No category']);
    expect(groups[0].products.map((product) => product.id)).toEqual(['2', '3']);
    expect(groups[1].products.map((product) => product.id)).toEqual(['1']);
    expect(groups[2].products.map((product) => product.id)).toEqual(['4']);
  });
});

describe('sortProductsForCatalogPrint', () => {
  it('sorts products within the same category alphabetically', () => {
    const sorted = sortProductsForCatalogPrint(
      [
        { id: 'p1', nameAr: 'Apple', categoryId: 'c1' },
        { id: 'p2', nameAr: 'Pineapple', categoryId: 'c1' },
      ],
      [{ id: 'c1', nameAr: 'Fruit', sortOrder: 0 }],
    );

    expect(sorted.map((product) => product.nameAr)).toEqual(['Apple', 'Pineapple']);
  });
});

describe('buildItemsCatalogPdfFilename', () => {
  it('builds a stable filename from filters', () => {
    const name = buildItemsCatalogPdfFilename(
      { section: 'Kitchen', categoryId: 'c1', productType: 'order' },
      [{ id: 'c1', nameAr: 'Meat' }],
      [{ id: 's1', nameAr: 'Kitchen' } satisfies OrderSection],
    );
    expect(name).toMatch(/^items-catalog-order-kitchen-meat-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});

describe('expandProductsToPrintRows', () => {
  it('uses one detailed row per variant', () => {
    const rows = expandProductsToPrintRows(
      [
        {
          id: 'p1',
          nameAr: 'Chicken',
          nameEn: 'Chicken',
          variants: [
            { size: 'small', packaging: 'bag', unit: 'kg' },
            { size: 'large', packaging: 'box', unit: 'box' },
          ],
        },
        { id: 'p2', nameAr: 'Salt', unit: 'piece' },
      ],
      unitLabel,
    );

    expect(rows).toHaveLength(3);
    expect(rows[0].nameAr).toBe('Chicken');
    expect(rows[0]).toMatchObject({ size: 'small', packaging: 'bag', unit: 'kg' });
    expect(rows[1]).toMatchObject({ size: 'large', packaging: 'box', unit: 'box' });
    expect(rows[2]).toMatchObject({ nameAr: 'Salt', unit: 'piece' });
  });
});
