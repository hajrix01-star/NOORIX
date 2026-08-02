import { describe, expect, it } from 'vitest';

import type { OrderProduct } from '../../../types/api';
import {
  defaultVariantModalState,
  displayProductPrice,
  firstProductPricedChoice,
  productHasVariants,
  resolveVariantFromModal,
} from './staffOrderBasketUtils';

const productWithPricedChoices: OrderProduct = {
  id: 'charcoal',
  nameAr: 'Charcoal',
  unit: 'piece',
  sizes: 'legacy-size',
  variants: [
    { size: 'single', unit: 'piece', lastPrice: 5 },
    { packaging: 'carton', unit: 'carton', lastPrice: 80, quantityMultiplier: 99 },
    { size: 'unpriced', unit: 'piece', lastPrice: 0 },
    { size: 'disconnected', unit: 'kg', lastPrice: 50 },
  ],
  inventoryConversions: [
    { fromUnit: 'carton', toUnit: 'piece', multiplier: 16 },
  ],
};

describe('staff order product unit selection', () => {
  it('creates and resolves modal state from central priced choices only', () => {
    const firstChoice = firstProductPricedChoice(productWithPricedChoices);
    const modal = defaultVariantModalState(productWithPricedChoices);

    expect(firstChoice).toMatchObject({ size: 'single', unit: 'piece', unitPrice: '5' });
    expect(productHasVariants(productWithPricedChoices)).toBe(true);
    expect(modal).toMatchObject({
      variantKey: firstChoice?.key,
      size: 'single',
      packaging: '',
      unit: 'piece',
      unitPrice: '5',
    });
    expect(modal).not.toBeNull();
    if (!modal) return;

    expect(resolveVariantFromModal(productWithPricedChoices, modal)).toEqual({
      size: 'single',
      packaging: '',
      unit: 'piece',
      unitPrice: '5',
    });
    expect(resolveVariantFromModal(productWithPricedChoices, {
      ...modal,
      variantKey: 'legacy-size',
    })).toBeNull();
  });

  it('does not turn legacy sizes or quantity multipliers into new choices', () => {
    const legacyOnly: OrderProduct = {
      id: 'legacy-only',
      nameAr: 'Legacy only',
      unit: 'piece',
      sizes: 'large,small',
      variants: [{ unit: 'piece', lastPrice: '', quantityMultiplier: 12 }],
    };

    expect(firstProductPricedChoice(legacyOnly)).toBeNull();
    expect(productHasVariants(legacyOnly)).toBe(false);
    expect(defaultVariantModalState(legacyOnly)).toBeNull();
    expect(displayProductPrice(legacyOnly)).toBeNull();
  });

  it('keeps a single base-unit price on the plain quantity path', () => {
    const simple: OrderProduct = {
      id: 'simple',
      nameAr: 'Simple',
      unit: 'piece',
      sizes: 'legacy-size',
      lastPrice: 12,
    };

    expect(firstProductPricedChoice(simple)).toMatchObject({
      size: '',
      packaging: '',
      unit: 'piece',
      unitPrice: '12',
    });
    expect(productHasVariants(simple)).toBe(false);
    expect(displayProductPrice(simple)).toBe('12');
  });
});
