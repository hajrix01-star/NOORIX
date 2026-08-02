import { describe, expect, it } from 'vitest';
import {
  buildEditableOrderProduct,
  buildOrderProductPayload,
  filterRecipeMaterialProducts,
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

  it('limits recipe materials to inventory/order products', () => {
    const material = { ...products[0], id: 'material-1', productType: 'order' as const };
    const sold = { ...products[1], id: 'sale-1', productType: 'sale' as const };
    const legacyMaterial = { ...products[1], id: 'legacy-material', productType: undefined };
    const inactiveMaterial = { ...products[0], id: 'inactive-material', productType: 'order' as const, isActive: false };

    expect(filterRecipeMaterialProducts([material, sold, legacyMaterial, inactiveMaterial], 'material-1')).toEqual([legacyMaterial]);
    expect(filterRecipeMaterialProducts([material, sold, legacyMaterial, inactiveMaterial])).toEqual([material, legacyMaterial]);
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
      unit: 'piece',
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
      unit: 'piece',
      variants: [{
        size: 'large',
        packaging: '',
        unit: 'piece',
        lastPrice: '25',
      }],
    });
  });

  it('stores catalog prices as size, packaging, unit, and price only', () => {
    const payload = buildOrderProductPayload({
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
        },
      ],
    }, 'order');

    expect(payload.variants).toEqual([{
      size: '',
      packaging: 'نصف كرتون',
      unit: 'carton',
      lastPrice: '72.5',
    }]);
  });

  it('reads a legacy multiplier without writing it back through the catalog form', () => {
    const editable = buildEditableOrderProduct({
      id: 'legacy-charcoal',
      nameAr: 'فحم',
      unit: 'piece',
      variants: [{ unit: 'piece', quantityMultiplier: '5' }],
    }, 'order');

    expect(editable._advanced).toBe(true);
    expect(editable.variants).toEqual([{
      size: '',
      packaging: '',
      unit: 'piece',
      lastPrice: '',
    }]);
    expect(buildOrderProductPayload(editable, 'order').variants).toBeUndefined();
  });

  it('keeps recipe rows for sale products and omits them for order products', () => {
    const form = {
      nameAr: 'Shisha',
      nameEn: 'Shisha',
      categoryId: 'c1',
      sectionIds: ['bar'],
      simpleLastPrice: '25',
      variants: [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }],
      recipe: [
        { materialType: 'tobacco' as const, materialProductId: 'tobacco-1', quantity: '20', unit: 'g' },
        { materialType: 'hose' as const, materialProductId: 'hose-1', quantity: '1', unit: 'piece' },
        { materialType: 'charcoal' as const, materialProductId: 'charcoal-1', quantity: '2', unit: 'piece' },
      ],
    };

    expect(buildOrderProductPayload(form, 'sale')).toMatchObject({
      productType: 'sale',
      recipe: form.recipe,
    });
    expect(buildOrderProductPayload(form, 'order')).not.toHaveProperty('recipe');
  });

  it('keeps generic material recipe rows for sold products', () => {
    const payload = buildOrderProductPayload({
      nameAr: 'Orange Juice',
      nameEn: 'Orange Juice',
      categoryId: 'juice',
      sectionIds: ['bar'],
      simpleLastPrice: '12',
      variants: [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }],
      recipe: [
        { materialType: 'material', materialProductId: 'orange-kg', quantity: '3', unit: 'piece' },
      ],
    }, 'sale');

    expect(payload).toMatchObject({
      productType: 'sale',
      recipe: [
        { materialType: 'material', materialProductId: 'orange-kg', quantity: '3', unit: 'piece' },
      ],
    });
  });

  it('keeps inventory conversions for order products only', () => {
    const form = {
      nameAr: 'Orange',
      nameEn: 'Orange',
      categoryId: 'fruit',
      sectionIds: ['bar'],
      simpleLastPrice: '',
      variants: [{ size: '', packaging: '', unit: 'piece', lastPrice: '' }],
      inventoryConversions: [
        { fromUnit: 'kg', toUnit: 'piece', multiplier: '6', label: 'kilo to pieces' },
      ],
      recipe: [],
    };

    expect(buildOrderProductPayload(form, 'order')).toMatchObject({
      productType: 'order',
      unit: 'piece',
      inventoryConversions: [
        { fromUnit: 'kg', toUnit: 'piece', multiplier: '6', label: 'kilo to pieces' },
      ],
    });
    expect(buildOrderProductPayload(form, 'sale')).not.toHaveProperty('inventoryConversions');
  });

  it('keeps an independent inventory base unit for order products', () => {
    const payload = buildOrderProductPayload({
      nameAr: 'Charcoal',
      nameEn: 'Charcoal',
      unit: 'piece',
      variants: [{ size: '', packaging: 'Carton', unit: 'carton', lastPrice: '145' }],
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      ],
      recipe: [],
    }, 'order');

    expect(payload).toMatchObject({
      productType: 'order',
      unit: 'piece',
      variants: [{ packaging: 'Carton', unit: 'carton', lastPrice: '145' }],
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      ],
    });
  });
});
