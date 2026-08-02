import { describe, expect, it } from 'vitest';

import type { OrderProduct } from '../../../types/api';
import {
  buildProductUnitSelectionModel,
  catalogConversionUnitValues,
  conversionRowsFromUnknown,
  findCatalogConversionSequenceIssue,
  normalizeCatalogUnit,
  productConvertibleUnitValues,
  productInventoryConversions,
  resolveCatalogUnitMultiplier,
  resolveVariantInventoryMultiplier,
} from './productUnitConversionModel';

const charcoal: OrderProduct = {
  id: 'material-charcoal',
  nameAr: 'فحم',
  productType: 'order',
  unit: 'حبة',
  inventoryConversions: [
    { fromUnit: 'كرتون', toUnit: 'علبة', multiplier: 10 },
    { fromUnit: 'علبة', toUnit: 'حبة', multiplier: 64 },
  ],
};

describe('product unit conversion model', () => {
  it('normalizes the supported Arabic inventory units', () => {
    expect(normalizeCatalogUnit('حبة')).toBe('piece');
    expect(normalizeCatalogUnit('علبة')).toBe('pack');
    expect(normalizeCatalogUnit('كرتون')).toBe('carton');
    expect(normalizeCatalogUnit('كيلو')).toBe('kg');
    expect(normalizeCatalogUnit('جرام')).toBe('g');
  });

  it('rejects malformed conversion rows', () => {
    expect(conversionRowsFromUnknown([
      { fromUnit: 'كرتون', toUnit: 'علبة', multiplier: 10 },
      { fromUnit: '', toUnit: 'حبة', multiplier: 64 },
      { fromUnit: 'علبة', toUnit: 'حبة', multiplier: 0 },
      null,
    ])).toEqual([
      { fromUnit: 'كرتون', toUnit: 'علبة', multiplier: 10 },
    ]);
  });

  it('resolves chained and reverse inventory conversions', () => {
    const conversions = productInventoryConversions(charcoal);

    expect(resolveCatalogUnitMultiplier(conversions, 'كرتون', 'حبة')).toBe(640);
    expect(resolveCatalogUnitMultiplier(conversions, 'حبة', 'كرتون')).toBeCloseTo(1 / 640);
  });

  it('exposes only units connected to the stock unit', () => {
    expect(productConvertibleUnitValues(charcoal)).toEqual(
      expect.arrayContaining(['piece', 'pack', 'carton']),
    );
    expect(productConvertibleUnitValues(charcoal)).not.toEqual(
      expect.arrayContaining(['kg', 'g', 'l', 'ml']),
    );
  });

  it('exposes pricing units from explicit conversions only', () => {
    expect(catalogConversionUnitValues('g', [])).toEqual(['g']);
    expect(resolveCatalogUnitMultiplier([], 'kg', 'g')).toBeNull();
    expect(catalogConversionUnitValues('piece', [
      { fromUnit: 'carton', toUnit: 'pack', multiplier: 10 },
    ])).toEqual(['piece']);
    expect(catalogConversionUnitValues('g', [
      { fromUnit: 'kg', toUnit: 'g', multiplier: 1000 },
    ])).toEqual(expect.arrayContaining(['g', 'kg']));
  });

  it('uses the conversion chain before the legacy read-only multiplier', () => {
    expect(resolveVariantInventoryMultiplier(
      {
        packaging: 'كرتون',
        unit: 'علبة',
        quantityMultiplier: 5,
      },
      charcoal.unit,
      productInventoryConversions(charcoal),
    )).toBe(640);
    expect(resolveVariantInventoryMultiplier(
      { unit: 'carton', quantityMultiplier: 5 },
      'piece',
      [],
    )).toBe(5);
  });

  it('merges and deduplicates product and template conversions', () => {
    const product: OrderProduct = {
      ...charcoal,
      conversionTemplate: {
        id: 'template-1',
        code: 'carton-pack-piece',
        nameAr: 'كرتون إلى حبة',
        conversions: [
          { fromUnit: 'كرتون', toUnit: 'علبة', multiplier: 10 },
          { fromUnit: 'علبة', toUnit: 'حبة', multiplier: 64 },
        ],
      },
    };

    expect(productInventoryConversions(product)).toHaveLength(2);
  });

  it('detects a conversion stage that is disconnected from the purchase chain', () => {
    expect(findCatalogConversionSequenceIssue({
      purchaseUnit: 'كرتون',
      baseUnit: 'حبة',
      conversions: [
        { fromUnit: 'كرتون', toUnit: 'علبة', multiplier: 10 },
        { fromUnit: 'كيلو', toUnit: 'حبة', multiplier: 64 },
      ],
    })).toEqual({
      kind: 'disconnected',
      index: 1,
      expectedFromUnit: 'pack',
      actualFromUnit: 'kg',
    });
  });

  it('requires a conversion when the purchase and stock units differ', () => {
    expect(findCatalogConversionSequenceIssue({
      purchaseUnit: 'كرتون',
      baseUnit: 'حبة',
      conversions: [],
    })).toEqual({
      kind: 'incomplete',
      index: 0,
      expectedFromUnit: 'piece',
      actualFromUnit: 'carton',
    });
  });

  it('requires standard purchase-to-stock conversions to be explicit rows', () => {
    expect(findCatalogConversionSequenceIssue({
      purchaseUnit: 'كيلو',
      baseUnit: 'جرام',
      conversions: [],
    })).toEqual({
      kind: 'incomplete',
      index: 0,
      expectedFromUnit: 'g',
      actualFromUnit: 'kg',
    });

    expect(findCatalogConversionSequenceIssue({
      purchaseUnit: 'لتر',
      baseUnit: 'مل',
      conversions: [],
    })).toEqual({
      kind: 'incomplete',
      index: 0,
      expectedFromUnit: 'ml',
      actualFromUnit: 'l',
    });
  });

  it('rejects a custom stage that omits the final explicit conversion', () => {
    expect(findCatalogConversionSequenceIssue({
      purchaseUnit: 'كرتون',
      baseUnit: 'جرام',
      conversions: [
        { fromUnit: 'كرتون', toUnit: 'كيلو', multiplier: 10 },
      ],
    })).toEqual({
      kind: 'incomplete',
      index: 1,
      expectedFromUnit: 'g',
      actualFromUnit: 'kg',
    });
  });

  it('rejects a connected chain that stops before the stock unit', () => {
    expect(findCatalogConversionSequenceIssue({
      purchaseUnit: 'كرتون',
      baseUnit: 'حبة',
      conversions: [
        { fromUnit: 'كرتون', toUnit: 'علبة', multiplier: 10 },
      ],
    })).toEqual({
      kind: 'incomplete',
      index: 1,
      expectedFromUnit: 'piece',
      actualFromUnit: 'pack',
    });
  });

  it('validates the conversion chain independently from the selected price unit', () => {
    expect(findCatalogConversionSequenceIssue({
      baseUnit: 'piece',
      conversions: [
        { fromUnit: 'carton', toUnit: 'pack', multiplier: 10 },
      ],
    })).toEqual({
      kind: 'incomplete',
      index: 1,
      expectedFromUnit: 'piece',
      actualFromUnit: 'pack',
    });
  });

  it('accepts a connected purchase-to-stock conversion chain', () => {
    expect(findCatalogConversionSequenceIssue({
      purchaseUnit: 'كرتون',
      baseUnit: 'حبة',
      conversions: conversionRowsFromUnknown(charcoal.inventoryConversions),
    })).toBeNull();
  });

  it('builds priced choices only from units connected to the stock unit', () => {
    const model = buildProductUnitSelectionModel({
      ...charcoal,
      lastPrice: '145',
      variants: [
        {
          size: 'كرتون فحم',
          packaging: 'كرتون',
          unit: 'كرتون',
          lastPrice: '145',
          quantityMultiplier: 999,
        },
        {
          size: 'وحدة غير مرتبطة',
          packaging: 'درزن',
          unit: 'درزن',
          lastPrice: '20',
          quantityMultiplier: 12,
        },
      ],
    });

    expect(model.baseUnit).toBe('piece');
    expect(model.convertibleUnits).toEqual(expect.arrayContaining(['piece', 'pack', 'carton']));
    expect(model.pricedChoices).toEqual([expect.objectContaining({
      size: 'كرتون فحم',
      unit: 'carton',
      unitPrice: '145',
      inventoryMultiplier: 640,
    })]);
  });

  it('keeps numeric MoneyLike prices when building choices from a conversion template', () => {
    const model = buildProductUnitSelectionModel({
      unit: 'piece',
      conversionTemplate: {
        id: 'template-carton-piece',
        code: 'carton-piece',
        nameAr: 'Carton to piece',
        conversions: [
          { fromUnit: 'carton', toUnit: 'piece', multiplier: 24 },
        ],
      },
      variants: [
        { unit: 'carton', lastPrice: 72.5 },
      ],
    });

    expect(model.pricedChoices).toEqual([expect.objectContaining({
      unit: 'carton',
      unitPrice: '72.5',
      inventoryMultiplier: 24,
    })]);

    const fallbackModel = buildProductUnitSelectionModel({
      unit: 'piece',
      lastPrice: 31.25,
    });
    expect(fallbackModel.pricedChoices).toEqual([expect.objectContaining({
      unit: 'piece',
      unitPrice: '31.25',
      inventoryMultiplier: 1,
    })]);
  });

  it('keeps and trims textual MoneyLike prices', () => {
    const model = buildProductUnitSelectionModel({
      unit: 'piece',
      variants: [
        { unit: 'piece', lastPrice: ' 18.75 ' },
      ],
    });

    expect(model.pricedChoices).toEqual([expect.objectContaining({
      unitPrice: '18.75',
    })]);
  });

  it('does not add choices for invalid MoneyLike prices', () => {
    const model = buildProductUnitSelectionModel({
      unit: 'piece',
      lastPrice: Number.POSITIVE_INFINITY,
      variants: [
        { unit: 'piece', lastPrice: 0 },
        { unit: 'piece', lastPrice: -1 },
        { unit: 'piece', lastPrice: Number.NaN },
        { unit: 'piece', lastPrice: Number.POSITIVE_INFINITY },
        { unit: 'piece', lastPrice: '' },
        { unit: 'piece', lastPrice: 'not-a-price' },
      ],
    });

    expect(model.pricedChoices).toEqual([]);
  });

  it('does not create new choices from legacy sizes or quantity multipliers', () => {
    const model = buildProductUnitSelectionModel({
      ...charcoal,
      variants: [
        {
          size: 'قديم',
          packaging: 'درزن',
          unit: 'درزن',
          lastPrice: '12',
          quantityMultiplier: 12,
        },
      ],
      lastPrice: '5',
    });

    expect(model.pricedChoices).toEqual([expect.objectContaining({
      unit: 'piece',
      unitPrice: '5',
      inventoryMultiplier: 1,
    })]);
  });
});
