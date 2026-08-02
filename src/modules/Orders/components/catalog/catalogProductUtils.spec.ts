import { describe, expect, it } from 'vitest';
import { productPriceLineShort, productVariantsSummary } from './catalogProductUtils';

describe('catalogProductUtils', () => {
  it('keeps price separate from technical variant details', () => {
    const product = {
      id: 'charcoal',
      nameAr: 'فحم',
      variants: [
        { packaging: 'علبة', unit: 'pack', lastPrice: 14.5 },
        { packaging: 'كرتون', unit: 'carton', lastPrice: 145 },
      ],
    };

    expect(productPriceLineShort(product)).toBe('14.5 – 145');
    expect(productVariantsSummary(product, (unit) => ({ pack: 'علبة', carton: 'كرتون' }[unit] || unit)))
      .toBe('علبة · كرتون');
  });

  it('shows a simple product price without unit noise', () => {
    expect(productPriceLineShort({ id: 'p1', nameAr: 'ماء', unit: 'piece', lastPrice: 3 })).toBe('3');
  });
});
