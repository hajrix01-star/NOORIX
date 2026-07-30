import {
  resolveQuantityMultiplier,
  standardCharcoalVariants,
} from './orders-quantity-multiplier.util';

describe('resolveQuantityMultiplier', () => {
  const product = {
    variants: [
      { packaging: 'علبة', unit: 'pack', quantityMultiplier: '1' },
      { packaging: 'نصف كرتون', unit: 'carton', quantityMultiplier: '5' },
      { packaging: 'كرتون', unit: 'carton', quantityMultiplier: '10' },
      { packaging: 'كرتون ونصف', unit: 'carton', quantityMultiplier: '15' },
    ],
  };

  it('returns the base-box conversion for the selected packaging', () => {
    expect(resolveQuantityMultiplier(product, { packaging: 'نصف كرتون', unit: 'carton' }).toNumber()).toBe(5);
    expect(resolveQuantityMultiplier(product, { packaging: 'كرتون ونصف', unit: 'carton' }).toNumber()).toBe(15);
  });

  it('falls back to one for products without an inventory conversion', () => {
    expect(resolveQuantityMultiplier({ variants: [] }, { packaging: '', unit: 'piece' }).toNumber()).toBe(1);
    expect(resolveQuantityMultiplier({
      variants: [{ packaging: 'legacy', unit: 'piece', quantityMultiplier: 'invalid' }],
    }, { packaging: 'legacy', unit: 'piece' }).toNumber()).toBe(1);
  });

  it('derives every purchase packaging price from the carton price', () => {
    const variants = standardCharcoalVariants('145');
    expect(variants.find((variant) => variant.packaging === 'علبة')).toMatchObject({
      lastPrice: '14.5',
      quantityMultiplier: '1',
    });
    expect(variants.find((variant) => variant.packaging === 'نصف كرتون')).toMatchObject({
      lastPrice: '72.5',
      quantityMultiplier: '5',
    });
    expect(variants.find((variant) => variant.packaging === 'كرتون ونصف')).toMatchObject({
      lastPrice: '217.5',
      quantityMultiplier: '15',
    });
  });
});
