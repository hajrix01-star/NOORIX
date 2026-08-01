import { describe, expect, it } from 'vitest';

import type { OrderProduct } from '../../../types/api';
import {
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

  it('uses the conversion chain before a legacy variant multiplier', () => {
    expect(resolveVariantInventoryMultiplier(
      {
        packaging: 'كرتون',
        unit: 'علبة',
        quantityMultiplier: 5,
      },
      charcoal.unit,
      productInventoryConversions(charcoal),
    )).toBe(640);
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

  it('accepts standard purchase-to-stock conversions without explicit rows', () => {
    expect(findCatalogConversionSequenceIssue({
      purchaseUnit: 'كيلو',
      baseUnit: 'جرام',
      conversions: [],
    })).toBeNull();

    expect(findCatalogConversionSequenceIssue({
      purchaseUnit: 'لتر',
      baseUnit: 'مل',
      conversions: [],
    })).toBeNull();
  });

  it('accepts a custom stage that finishes through a standard conversion', () => {
    expect(findCatalogConversionSequenceIssue({
      purchaseUnit: 'كرتون',
      baseUnit: 'جرام',
      conversions: [
        { fromUnit: 'كرتون', toUnit: 'كيلو', multiplier: 10 },
      ],
    })).toBeNull();
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

  it('accepts a connected purchase-to-stock conversion chain', () => {
    expect(findCatalogConversionSequenceIssue({
      purchaseUnit: 'كرتون',
      baseUnit: 'حبة',
      conversions: conversionRowsFromUnknown(charcoal.inventoryConversions),
    })).toBeNull();
  });
});
