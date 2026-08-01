import { resolveQuantityMultiplierOrNull } from './orders-quantity-multiplier.util';

describe('resolveQuantityMultiplierOrNull', () => {
  it('resolves an explicit conversion chain for new writes', () => {
    const material = {
      unit: 'piece',
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'box', multiplier: '10' },
        { fromUnit: 'box', toUnit: 'piece', multiplier: '64' },
      ],
    };

    expect(
      resolveQuantityMultiplierOrNull(material, { unit: 'carton' })?.toNumber(),
    ).toBe(640);
  });

  it('accepts the base unit without an explicit conversion', () => {
    expect(
      resolveQuantityMultiplierOrNull(
        { unit: 'piece' },
        { unit: 'piece' },
      )?.toNumber(),
    ).toBe(1);
  });

  it('resolves the full chain from purchased packaging to inventory unit', () => {
    expect(
      resolveQuantityMultiplierOrNull(
        {
          unit: 'piece',
          inventoryConversions: [
            { fromUnit: 'carton', toUnit: 'box', multiplier: '10' },
            { fromUnit: 'box', toUnit: 'piece', multiplier: '64' },
          ],
        },
        { packaging: 'carton', unit: 'box' },
      )?.toNumber(),
    ).toBe(640);
  });

  it('rejects unknown or invalid conversions for new writes', () => {
    expect(
      resolveQuantityMultiplierOrNull(
        { unit: 'piece' },
        { unit: 'carton' },
      ),
    ).toBeNull();
    expect(
      resolveQuantityMultiplierOrNull(
        {
          unit: 'piece',
          variants: [
            {
              packaging: 'legacy',
              unit: 'piece',
              quantityMultiplier: 'invalid',
            },
          ],
        },
        { packaging: 'legacy', unit: 'piece' },
      ),
    ).toBeNull();
  });
});
