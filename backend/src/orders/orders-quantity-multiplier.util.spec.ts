import { resolveQuantityMultiplier } from './orders-quantity-multiplier.util';

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

  it('treats half-pack as half of the charcoal base box', () => {
    expect(resolveQuantityMultiplier({ variants: [] }, { unit: 'half_pack' }).toNumber()).toBe(0.5);
  });

  it('uses product unit conversion chains when no legacy variant matches', () => {
    const material = {
      unit: 'piece',
      variants: [],
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'box', multiplier: '10' },
        { fromUnit: 'box', toUnit: 'piece', multiplier: '64' },
      ],
    };

    expect(resolveQuantityMultiplier(material, { unit: 'carton' }).toNumber()).toBe(640);
    expect(resolveQuantityMultiplier(material, { unit: 'box' }).toNumber()).toBe(64);
  });

  it('prefers an explicit conversion chain over a matching legacy multiplier', () => {
    const material = {
      unit: 'piece',
      variants: [
        { packaging: 'legacy carton', unit: 'carton', quantityMultiplier: '999' },
      ],
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'box', multiplier: '10' },
        { fromUnit: 'box', toUnit: 'piece', multiplier: '64' },
      ],
    };

    expect(resolveQuantityMultiplier(material, {
      packaging: 'legacy carton',
      unit: 'carton',
    }).toNumber()).toBe(640);
  });

  it('reads a legacy multiplier only when the explicit conversion chain is disconnected', () => {
    const material = {
      unit: 'piece',
      variants: [
        { packaging: 'legacy carton', unit: 'carton', quantityMultiplier: '640' },
      ],
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'box', multiplier: '10' },
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      ],
    };

    expect(resolveQuantityMultiplier(material, {
      packaging: 'legacy carton',
      unit: 'carton',
    }).toNumber()).toBe(640);
  });

  it('uses the invoice unit while keeping packaging descriptive', () => {
    const material = {
      unit: 'piece',
      variants: [],
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'box', multiplier: '10' },
        { fromUnit: 'box', toUnit: 'piece', multiplier: '64' },
      ],
    };

    expect(resolveQuantityMultiplier(material, {
      packaging: 'carton',
      unit: 'box',
    }).toNumber()).toBe(64);
  });

  it('does not require a conversion when selection and base unit are semantic aliases', () => {
    expect(resolveQuantityMultiplier({ unit: 'piece', variants: [] }, { unit: 'حبة' }).toNumber()).toBe(1);
  });
});
