import { describe, expect, it } from 'vitest';
import {
  buildOrderProductPayload,
  filterOrderCategoriesForManageTab,
  filterOrderProductsForManageTab,
} from './itemsManageModel';
import type { OrderCategory, OrderProduct } from '../../../types/api';

describe('itemsManageModel', () => {
  const products: OrderProduct[] = [
    {
      id: 'p1',
      nameAr: 'Chicken burger',
      nameEn: 'Chicken burger',
      categoryId: 'c1',
      category: { id: 'c1', nameAr: 'Meals', nameEn: 'Meals' },
      sections: ['hot'],
      variants: [{ size: 'large', packaging: 'box', unit: 'piece', lastPrice: '20' }],
    },
    {
      id: 'p2',
      nameAr: 'Water',
      nameEn: 'Water',
      categoryId: 'c2',
      sections: [],
      variants: [],
    },
  ];

  it('filters products by text, category, and section', () => {
    expect(filterOrderProductsForManageTab(products, 'burger', '', '')).toHaveLength(1);
    expect(filterOrderProductsForManageTab(products, '', 'hot', '')).toEqual([products[0]]);
    expect(filterOrderProductsForManageTab(products, '', '__none__', '')).toEqual([products[1]]);
    expect(filterOrderProductsForManageTab(products, '', '', 'c2')).toEqual([products[1]]);
  });

  it('filters categories by Arabic or English name', () => {
    const categories: OrderCategory[] = [
      { id: 'c1', nameAr: 'Meals', nameEn: 'Meals' },
      { id: 'c2', nameAr: 'Drinks', nameEn: 'Drinks' },
    ];
    expect(filterOrderCategoriesForManageTab(categories, 'drink')).toEqual([categories[1]]);
    expect(filterOrderCategoriesForManageTab(categories, 'meal')).toEqual([categories[0]]);
  });

  it('builds a simple product payload when no real variants exist', () => {
    expect(buildOrderProductPayload({
      nameAr: '  Water  ',
      nameEn: '',
      categoryId: '',
      sectionIds: [''],
      simpleLastPrice: '5',
      variants: [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }],
    }, 'sale')).toEqual({
      nameAr: 'Water',
      nameEn: undefined,
      categoryId: undefined,
      sectionIds: undefined,
      productType: 'sale',
      lastPrice: '5',
    });
  });

  it('builds a variants payload and normalizes empty fields', () => {
    expect(buildOrderProductPayload({
      nameAr: 'Meal',
      nameEn: 'Meal',
      categoryId: 'c1',
      sectionIds: ['hot', ''],
      variants: [
        { size: 'large', packaging: '', unit: '', lastPrice: '25' },
        { size: '', packaging: '', unit: 'piece', lastPrice: '' },
      ],
    }, 'order')).toEqual({
      nameAr: 'Meal',
      nameEn: 'Meal',
      categoryId: 'c1',
      sectionIds: ['hot'],
      productType: 'order',
      variants: [{
        size: 'large',
        packaging: '',
        unit: 'piece',
        lastPrice: '25',
        quantityMultiplier: '1',
      }],
    });
  });

  it('preserves packaging conversion multipliers in the catalog payload', () => {
    expect(buildOrderProductPayload({
      nameAr: 'فحم',
      nameEn: 'Charcoal',
      categoryId: '',
      sectionIds: ['shisha'],
      variants: [
        {
          size: '',
          packaging: 'نصف كرتون',
          unit: 'carton',
          lastPrice: '72.5',
          quantityMultiplier: '5',
        },
      ],
    }, 'order')).toMatchObject({
      nameAr: 'فحم',
      productType: 'order',
      variants: [{
        size: '',
        packaging: 'نصف كرتون',
        unit: 'carton',
        lastPrice: '72.5',
        quantityMultiplier: '5',
      }],
    });
  });
});
