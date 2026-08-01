import { findNegativeInventoryShortages } from './orders-negative-inventory.util';

describe('findNegativeInventoryShortages', () => {
  it('aggregates pending snapshot consumption and reports projected shortages', () => {
    const stock = [{
      productId: 'material-1',
      productNameAr: 'مادة 1',
      productNameEn: 'Material 1',
      unit: 'piece',
      balanceBaseQuantity: '5',
    }];
    const snapshot = (quantityBase: string) => ({
      version: 1,
      source: 'captured',
      soldBaseQuantity: '1',
      components: [{ materialProductId: 'material-1', materialBaseUnit: 'piece', quantityBase }],
    });

    expect(findNegativeInventoryShortages(stock, [snapshot('3'), snapshot('4')])).toEqual([{
      productId: 'material-1',
      productNameAr: 'مادة 1',
      productNameEn: 'Material 1',
      unit: 'piece',
      availableQuantity: '5',
      requestedQuantity: '7',
      projectedQuantity: '-2',
    }]);
  });

  it('does not report inventory that remains at zero', () => {
    const stock = [{
      productId: 'material-1',
      productNameAr: 'مادة 1',
      productNameEn: null,
      unit: 'piece',
      balanceBaseQuantity: '5',
    }];
    const snapshot = {
      version: 1,
      source: 'captured',
      soldBaseQuantity: '1',
      components: [{ materialProductId: 'material-1', materialBaseUnit: 'piece', quantityBase: '5' }],
    };

    expect(findNegativeInventoryShortages(stock, [snapshot])).toEqual([]);
  });
});
