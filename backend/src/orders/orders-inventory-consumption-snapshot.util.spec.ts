import { Prisma } from '@prisma/client';
import {
  buildCancellationConsumptionSnapshot,
  buildInventoryConsumptionSnapshot,
  InventoryConsumptionSnapshotError,
} from './orders-inventory-consumption-snapshot.util';

describe('inventory consumption snapshots', () => {
  const material = {
    id: 'charcoal',
    nameAr: 'Charcoal',
    productType: 'order',
    unit: 'piece',
    inventoryConversions: [
      { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
    ],
  };
  const saleProduct = {
    id: 'shisha',
    nameAr: 'Shisha',
    productType: 'sale',
    unit: 'head',
    recipe: [
      { materialProductId: material.id, quantity: '0.25', unit: 'pack' },
    ],
  };

  it('freezes sold base quantity and resolved material conversions', () => {
    const snapshot = buildInventoryConsumptionSnapshot({
      saleProduct,
      soldQuantity: new Prisma.Decimal(2),
      soldQuantityMultiplier: new Prisma.Decimal(1),
      materialById: new Map([[material.id, material]]),
    });

    expect(snapshot).toEqual({
      version: 1,
      source: 'captured',
      soldBaseQuantity: '2',
      components: [{
        materialProductId: material.id,
        materialBaseUnit: 'piece',
        quantityBase: '32',
      }],
    });
  });

  it('rejects missing materials and missing conversion paths', () => {
    expect(() => buildInventoryConsumptionSnapshot({
      saleProduct,
      soldQuantity: '1',
      soldQuantityMultiplier: '1',
      materialById: new Map(),
    })).toThrow(InventoryConsumptionSnapshotError);

    expect(() => buildInventoryConsumptionSnapshot({
      saleProduct,
      soldQuantity: '1',
      soldQuantityMultiplier: '1',
      materialById: new Map([[material.id, { ...material, inventoryConversions: null }]]),
    })).toThrow('Missing inventory conversion');
  });

  it('consumes a purchased inventory material through a multi-stage recipe conversion', () => {
    const chainedMaterial = {
      ...material,
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      ],
    };
    const chainedSaleProduct = {
      ...saleProduct,
      recipe: [
        { materialProductId: material.id, quantity: '0.25', unit: 'carton' },
      ],
    };

    const snapshot = buildInventoryConsumptionSnapshot({
      saleProduct: chainedSaleProduct,
      soldQuantity: '2',
      soldQuantityMultiplier: '1',
      materialById: new Map([[material.id, chainedMaterial]]),
    });

    expect(snapshot.components).toEqual([{
      materialProductId: material.id,
      materialBaseUnit: 'piece',
      quantityBase: '320',
    }]);
  });

  it('rejects sale products used as inventory recipe materials', () => {
    expect(() => buildInventoryConsumptionSnapshot({
      saleProduct,
      soldQuantity: '1',
      soldQuantityMultiplier: '1',
      materialById: new Map([[material.id, { ...material, productType: 'sale' }]]),
    })).toThrow('not an inventory product');
  });

  it('reverses the remaining historical snapshot rather than the current recipe', () => {
    const original = buildInventoryConsumptionSnapshot({
      saleProduct,
      soldQuantity: '4',
      soldQuantityMultiplier: '1',
      materialById: new Map([[material.id, material]]),
    });
    const cancellation = buildCancellationConsumptionSnapshot({
      requestedSoldBaseQuantity: '1',
      recordedSnapshots: [original],
      estimatedCurrentSnapshot: original,
    });

    expect(cancellation.source).toBe('reversal');
    expect(cancellation.soldBaseQuantity).toBe('-1');
    expect(cancellation.components[0].quantityBase).toBe('-16');
  });

  it('marks cancellations of legacy rows as estimated and keeps values negative', () => {
    const estimated = buildInventoryConsumptionSnapshot({
      saleProduct,
      soldQuantity: '1',
      soldQuantityMultiplier: '1',
      materialById: new Map([[material.id, material]]),
    });
    const cancellation = buildCancellationConsumptionSnapshot({
      requestedSoldBaseQuantity: '1',
      recordedSnapshots: [null],
      estimatedCurrentSnapshot: estimated,
    });

    expect(cancellation.source).toBe('legacy_estimated');
    expect(cancellation.soldBaseQuantity).toBe('-1');
    expect(cancellation.components[0].quantityBase).toBe('-16');
  });
});
