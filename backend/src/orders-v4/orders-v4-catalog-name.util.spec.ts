import {
  ordersV4CatalogName,
  ordersV4CatalogNameKey,
  ordersV4DuplicateItemMessage,
} from './orders-v4-catalog-name.util';

describe('Orders V4 catalog item name governance', () => {
  it('collapses whitespace and normalizes letter case for duplicate comparison', () => {
    expect(ordersV4CatalogName('  Honey   BOX  ', 'اسم الصنف')).toBe('Honey BOX');
    expect(ordersV4CatalogNameKey('  Honey   BOX  ')).toBe('honey box');
  });

  it('returns a clear message for active and disabled matches', () => {
    expect(ordersV4DuplicateItemMessage('معسل', true)).toBe('يوجد صنف باسم "معسل" بالفعل');
    expect(ordersV4DuplicateItemMessage('معسل', false)).toContain('حالته معطل');
  });
});
