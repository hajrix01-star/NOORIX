import {
  legacyConversionRows,
  legacyConsolidatedRecipeRows,
  legacyPaymentMethod,
  legacyRecipeRows,
  legacyTargetId,
  legacyUnitDefinition,
  legacyUnitKey,
} from './orders-v4-legacy-cutover.mapping';

describe('Orders V4 legacy cutover mapping', () => {
  it('maps legacy aliases into one central unit identity', () => {
    expect(legacyUnitKey('حبة')).toBe('piece');
    expect(legacyUnitKey('kg')).toBe('kg');
    expect(legacyUnitDefinition('kg')).toMatchObject({ code: 'kg', dimension: 'mass' });
    expect(legacyTargetId('unit', 'piece')).toBe(legacyTargetId('unit', 'piece'));
  });

  it('keeps only valid unique conversion edges', () => {
    const rows = legacyConversionRows([
      { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
      { fromUnit: 'pack', toUnit: 'carton', multiplier: '0.1' },
      { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
      { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      { fromUnit: 'pack', toUnit: 'kg', multiplier: '2' },
      { fromUnit: 'piece', toUnit: 'carton', multiplier: '0.0015625' },
      { fromUnit: 'piece', toUnit: 'piece', multiplier: '1' },
    ]);
    expect(rows.map((row) => [row.fromUnitKey, row.toUnitKey, row.factor.toString()])).toEqual([
      ['carton', 'pack', '10'],
      ['pack', 'piece', '64'],
    ]);
  });

  it('maps recipes and legacy payment ownership without financial side effects', () => {
    expect(legacyRecipeRows([{ materialProductId: 'material-1', quantity: '2.5', unit: 'g' }])[0]).toMatchObject({ materialProductId: 'material-1', unitKey: 'g' });
    expect(legacyPaymentMethod('external')).toBe('custody');
    expect(legacyPaymentMethod('internal')).toBe('cash');
    expect(legacyPaymentMethod('transfer')).toBe('transfer');
  });

  it('consolidates duplicate recipe components before the unique V4 recipe write', () => {
    const rows = legacyConsolidatedRecipeRows([
      { materialProductId: 'material-1', quantity: '2', unit: 'g' },
      { materialProductId: 'material-1', quantity: '3', unit: 'g' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity.toString()).toBe('5');
  });
});
