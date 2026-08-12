import { describe, expect, it } from 'vitest';
import type { OrdersV4Item } from '../../../types/api';
import { filterOrdersV4CatalogItems, ordersV4ItemLastPrice, ordersV4ItemSalePrice } from './ordersV4Catalog.utils';

const item = {
  id: 'item-1', nameAr: 'قهوة عربية', nameEn: 'Arabic Coffee', sku: 'COF-1',
  itemType: 'purchased', categoryId: 'cat-1', isActive: true,
  sections: [{ section: { id: 'section-1', nameAr: 'بار' } }],
  units: [{ isActive: true, lastPrice: '18.5', salePrice: '21' }, { isActive: true, lastPrice: '20', salePrice: '24' }],
} as OrdersV4Item;

describe('Orders V4 catalog presentation', () => {
  it('filters by kind, text, category, and section', () => {
    expect(filterOrdersV4CatalogItems([item], {
      kind: 'purchased', search: 'coffee', categoryId: 'cat-1', sectionId: 'section-1',
    })).toEqual([item]);
    expect(filterOrdersV4CatalogItems([item], {
      kind: 'sale', search: '', categoryId: '', sectionId: '',
    })).toEqual([]);
  });

  it('selects the latest visible price summary safely', () => {
    expect(ordersV4ItemLastPrice(item)).toBe(20);
    expect(ordersV4ItemSalePrice(item)).toBe(24);
  });
});
