import { purchaseQuantityBase } from './shisha-inventory-input.util';

describe('shisha inventory input rules', () => {
  const settings = {
    charcoalPacksPerCarton: 10,
    charcoalPiecesPerPack: 64,
  };

  it('converts fractional cartons to charcoal pieces', () => {
    expect(purchaseQuantityBase(settings, {
      materialType: 'charcoal',
      quantity: '1.5',
      unit: 'carton',
    }).toNumber()).toBe(960);
  });
});
