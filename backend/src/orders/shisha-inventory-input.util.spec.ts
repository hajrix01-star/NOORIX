import {
  assertManualCharcoalPurchaseAllowed,
  purchaseQuantityBase,
} from './shisha-inventory-input.util';

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

  it('blocks manual charcoal entry for the linked catalog start day', () => {
    expect(() => assertManualCharcoalPurchaseAllowed({
      charcoalPurchaseProductId: 'charcoal-product',
      charcoalPurchaseTrackingStartedAt: new Date('2026-07-30T10:30:00.000Z'),
    }, new Date('2026-07-30T00:00:00.000Z'), ['charcoal'])).toThrow(
      'شراء الفحم مرتبط بصنف «فحم»',
    );
  });

  it('keeps tobacco and hose purchase entry available', () => {
    expect(() => assertManualCharcoalPurchaseAllowed({
      charcoalPurchaseProductId: 'charcoal-product',
      charcoalPurchaseTrackingStartedAt: new Date('2026-07-30T10:30:00.000Z'),
    }, new Date('2026-07-30T00:00:00.000Z'), ['tobacco', 'hose'])).not.toThrow();
  });
});
