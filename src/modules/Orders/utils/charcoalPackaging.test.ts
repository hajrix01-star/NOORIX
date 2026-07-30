import { describe, expect, it } from 'vitest';
import {
  buildStandardCharcoalVariants,
  charcoalVariantLabel,
  isCharcoalCatalogProduct,
  withStandardCharcoalVariants,
} from './charcoalPackaging';

describe('charcoal packaging', () => {
  it('recognizes purchase and internal-consumption charcoal products', () => {
    expect(isCharcoalCatalogProduct({ nameAr: 'فحم', nameEn: 'Charcoal' })).toBe(true);
    expect(isCharcoalCatalogProduct({ nameAr: 'استهلاك الفحم الفعلي', nameEn: '' })).toBe(true);
    expect(isCharcoalCatalogProduct({ nameAr: 'معسل', nameEn: 'Tobacco' })).toBe(false);
  });

  it('creates all standard packaging sizes and preserves the carton price ratio', () => {
    const variants = buildStandardCharcoalVariants([
      { packaging: 'كرتون', unit: 'carton', lastPrice: '145', quantityMultiplier: '10' },
    ], true);
    expect(variants).toHaveLength(8);
    expect(variants.find((variant) => variant.packaging === 'نصف كرتون')).toMatchObject({
      unit: 'carton',
      lastPrice: '72.5',
      quantityMultiplier: '5',
    });
    expect(variants.find((variant) => variant.packaging === 'علبة')).toMatchObject({
      unit: 'pack',
      lastPrice: '14.5',
      quantityMultiplier: '1',
    });
  });

  it('shows the employee a business label instead of a technical unit', () => {
    expect(charcoalVariantLabel({
      packaging: 'كرتون ونصف',
      unit: 'carton',
      quantityMultiplier: '15',
      lastPrice: '0',
    })).toBe('كرتون ونصف (15 علبة = 960 حبة)');
  });

  it('upgrades a plain charcoal product before the employee opens it', () => {
    const product = withStandardCharcoalVariants({
      id: 'charcoal',
      nameAr: 'فحم',
      nameEn: 'Charcoal',
      productType: 'sale',
      variants: [],
    });
    const variants = Array.isArray(product.variants) ? product.variants : [];
    expect(variants).toHaveLength(8);
    expect(variants[6]).toMatchObject({
      packaging: 'كرتون',
      unit: 'carton',
      quantityMultiplier: '10',
    });
  });
});
