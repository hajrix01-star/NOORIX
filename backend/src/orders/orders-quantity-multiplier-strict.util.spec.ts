import { resolveQuantityMultiplierOrNull } from './orders-quantity-multiplier.util';

describe('resolveQuantityMultiplierOrNull', () => {
  it('resolves an explicit conversion chain for new writes', () => {
    const material = {
      unit: 'piece',
      variants: [
        { unit: 'carton', quantityMultiplier: '999' },
      ],
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

  it('resolves the invoice unit and does not treat display packaging as stock', () => {
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
    ).toBe(64);
  });

  it('rejects a disconnected conversion chain without reading a legacy multiplier', () => {
    expect(
      resolveQuantityMultiplierOrNull(
        {
          unit: 'piece',
          variants: [
            { unit: 'carton', quantityMultiplier: '640' },
          ],
          inventoryConversions: [
            { fromUnit: 'carton', toUnit: 'box', multiplier: '10' },
            { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
          ],
        },
        { unit: 'carton' },
      ),
    ).toBeNull();
  });

  it('ignores legacy variant multipliers for current writes', () => {
    expect(
      resolveQuantityMultiplierOrNull(
        {
          unit: 'piece',
          variants: [
            {
              packaging: 'legacy',
              unit: 'piece',
              quantityMultiplier: '25',
            },
          ],
        },
        { packaging: 'legacy', unit: 'piece' },
      )?.toNumber(),
    ).toBe(1);
  });
});
