import {
  resolveProductUnitMultiplier,
  validateProductUnitConversions,
} from './orders-unit-conversions.util';

describe('orders unit conversions', () => {
  it('allows a clear chained product conversion path', () => {
    const issues = validateProductUnitConversions([
      { fromUnit: 'carton', toUnit: 'box', multiplier: '10' },
      { fromUnit: 'box', toUnit: 'piece', multiplier: '64' },
    ]);

    expect(issues).toEqual([]);
  });

  it('rejects ambiguous conversion paths from the same source unit', () => {
    const issues = validateProductUnitConversions([
      { fromUnit: 'carton', toUnit: 'box', multiplier: '10' },
      { fromUnit: 'carton', toUnit: 'piece', multiplier: '640' },
    ]);

    expect(issues).toEqual([
      expect.objectContaining({ code: 'ambiguous-source' }),
    ]);
  });

  it('resolves product purchases to the inventory base unit through the chain', () => {
    const product = {
      unit: 'piece',
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'box', multiplier: '10' },
        { fromUnit: 'box', toUnit: 'piece', multiplier: '64' },
      ],
    };

    expect(resolveProductUnitMultiplier(product, 'carton', 'piece').toNumber()).toBe(640);
    expect(resolveProductUnitMultiplier(product, 'box', 'piece').toNumber()).toBe(64);
  });
});
