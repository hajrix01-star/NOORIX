import { describe, expect, it } from 'vitest';
import {
  buildOrderProductPayload,
  filterOrderCategoriesForManageTab,
  filterOrderProductsForManageTab,
} from './itemsManageModel';

describe('itemsManageModel', () => {
  const products = [
    {
      id: 'p1',
      nameAr: 'برجر دجاج',
      nameEn: 'Chicken burger',
      categoryId: 'c1',
      category: { nameAr: 'وجبات', nameEn: 'Meals' },
      sections: ['hot'],
      variants: [{ size: 'large', packaging: 'box', unit: 'piece', lastPrice: '20' }],
    },
    {
      id: 'p2',
      nameAr: 'ماء',
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
    const categories = [
      { id: 'c1', nameAr: 'وجبات', nameEn: 'Meals' },
      { id: 'c2', nameAr: 'مشروبات', nameEn: 'Drinks' },
    ];
    expect(filterOrderCategoriesForManageTab(categories, 'drink')).toEqual([categories[1]]);
    expect(filterOrderCategoriesForManageTab(categories, 'وج')).toEqual([categories[0]]);
  });

  it('builds a simple product payload when no real variants exist', () => {
    expect(buildOrderProductPayload({
      nameAr: '  ماء  ',
      nameEn: '',
      categoryId: '',
      sectionIds: ['', undefined],
      simpleLastPrice: '5',
      variants: [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }],
    }, 'sale')).toEqual({
      nameAr: 'ماء',
      nameEn: undefined,
      categoryId: undefined,
      sectionIds: undefined,
      productType: 'sale',
      lastPrice: '5',
    });
  });

  it('builds a variants payload and normalizes empty fields', () => {
    expect(buildOrderProductPayload({
      nameAr: 'وجبة',
      nameEn: 'Meal',
      categoryId: 'c1',
      sectionIds: ['hot', ''],
      variants: [
        { size: 'large', packaging: '', unit: '', lastPrice: '25' },
        { size: '', packaging: '', unit: 'piece', lastPrice: '' },
      ],
    }, 'order')).toEqual({
      nameAr: 'وجبة',
      nameEn: 'Meal',
      categoryId: 'c1',
      sectionIds: ['hot'],
      productType: 'order',
      variants: [{ size: 'large', packaging: '', unit: 'piece', lastPrice: '25' }],
    });
  });
});
