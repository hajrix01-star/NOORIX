import { isCharcoalConsumptionProduct } from './shisha-inventory-source.service';

describe('isCharcoalConsumptionProduct', () => {
  it('accepts the linked product and employee-facing charcoal names', () => {
    expect(isCharcoalConsumptionProduct(
      { nameAr: 'فحم', nameEn: null },
      'plain-charcoal',
      'linked-charcoal',
    )).toBe(true);
    expect(isCharcoalConsumptionProduct(
      { nameAr: 'استهلاك الفحم الفعلي', nameEn: 'Actual charcoal consumption' },
      'legacy-charcoal',
      'linked-charcoal',
    )).toBe(true);
    expect(isCharcoalConsumptionProduct(
      { nameAr: 'أي اسم', nameEn: 'Charcoal' },
      'english-charcoal',
      'linked-charcoal',
    )).toBe(true);
  });

  it('does not reinterpret normal shisha items as charcoal', () => {
    expect(isCharcoalConsumptionProduct(
      { nameAr: 'شيشة 65', nameEn: null },
      'shisha',
      'linked-charcoal',
    )).toBe(false);
  });
});
