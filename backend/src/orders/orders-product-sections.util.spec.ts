import {
  canonicalOrderSections,
  canonicalizeOrderSectionIds,
  normalizeProductSections,
} from './orders-product-sections.util';

const sections = [
  { id: 'bar-primary', nameAr: 'بار', nameEn: 'Bar' },
  { id: 'bar-duplicate', nameAr: '  بار  ', nameEn: 'Bar duplicate' },
  { id: 'kitchen', nameAr: 'مطبخ', nameEn: 'Kitchen' },
];

describe('orders product section normalization', () => {
  it('keeps one canonical section for duplicate normalized names', () => {
    expect(canonicalOrderSections(sections)).toEqual([
      { id: 'bar-primary', nameAr: 'بار', nameEn: 'Bar' },
      { id: 'kitchen', nameAr: 'مطبخ', nameEn: 'Kitchen' },
    ]);
  });

  it('redirects duplicate section ids to the canonical id', () => {
    expect(canonicalizeOrderSectionIds(sections, ['bar-duplicate', 'bar-primary', 'kitchen'])).toEqual([
      'bar-primary',
      'kitchen',
    ]);
  });

  it('normalizes legacy names and ids into one canonical assignment', () => {
    expect(normalizeProductSections(sections, {
      sectionIds: ['bar-duplicate', 'bar-primary'],
      sections: [' بار ', 'بار'],
    })).toEqual({
      sectionIds: ['bar-primary'],
      sections: ['بار'],
    });
  });
});
