import {
  normalizeUnit,
  resolveProductUnitMultiplier,
  resolveProductUnitMultiplierOrNull,
  validateProductUnitConversionSequence,
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

  it('normalizes persisted Arabic labels to the canonical inventory unit', () => {
    expect(normalizeUnit(' حبة ')).toBe('piece');
    expect(normalizeUnit('علبة')).toBe('pack');
    expect(normalizeUnit('كرتون')).toBe('carton');
    expect(normalizeUnit('كيلو')).toBe('kg');
    expect(normalizeUnit('جرام')).toBe('g');
    expect(normalizeUnit('لتر')).toBe('l');
  });

  it('treats Arabic and canonical labels as the same unit', () => {
    expect(resolveProductUnitMultiplierOrNull({ unit: 'piece' }, 'حبة', 'piece')?.toNumber()).toBe(1);
    expect(resolveProductUnitMultiplierOrNull({ unit: 'جرام' }, 'كيلو', 'جرام')?.toNumber()).toBe(1000);
  });

  it('allows products without custom conversion stages', () => {
    expect(validateProductUnitConversionSequence({
      conversions: [],
      baseUnit: 'piece',
    })).toBeNull();
  });

  it('accepts a custom stage that finishes through a standard conversion', () => {
    expect(validateProductUnitConversionSequence({
      conversions: [{ fromUnit: 'carton', toUnit: 'kg', multiplier: '10' }],
      baseUnit: 'g',
    })).toBeNull();
  });

  it('rejects a chain that stops before the inventory unit', () => {
    expect(validateProductUnitConversionSequence({
      conversions: [{ fromUnit: 'carton', toUnit: 'pack', multiplier: '10' }],
      baseUnit: 'piece',
    })).toEqual(expect.objectContaining({
      code: 'incomplete',
      expectedFromUnit: 'piece',
      actualFromUnit: 'pack',
    }));
  });

  it('rejects disconnected conversion stages', () => {
    expect(validateProductUnitConversionSequence({
      conversions: [
        { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
        { fromUnit: 'box', toUnit: 'piece', multiplier: '64' },
      ],
      baseUnit: 'piece',
    })).toEqual(expect.objectContaining({
      code: 'disconnected',
      index: 1,
      expectedFromUnit: 'pack',
      actualFromUnit: 'box',
    }));
  });

  it('accepts a complete purchase-to-inventory chain', () => {
    expect(validateProductUnitConversionSequence({
      conversions: [
        { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      ],
      baseUnit: 'piece',
    })).toBeNull();
  });

  it('rejects a custom multiplier that conflicts with a standard conversion', () => {
    expect(validateProductUnitConversions([
      { fromUnit: 'kg', toUnit: 'g', multiplier: '500' },
    ])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'standard-conflict', fromUnit: 'kg', toUnit: 'g' }),
    ]));
  });

  it('accepts an explicit standard conversion with its exact multiplier', () => {
    expect(validateProductUnitConversions([
      { fromUnit: 'kg', toUnit: 'g', multiplier: '1000' },
    ])).toEqual([]);
  });

  it('rejects cyclic conversion chains', () => {
    expect(validateProductUnitConversions([
      { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
      { fromUnit: 'pack', toUnit: 'box', multiplier: '2' },
      { fromUnit: 'box', toUnit: 'carton', multiplier: '3' },
    ])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'cycle' }),
    ]));
  });
});
