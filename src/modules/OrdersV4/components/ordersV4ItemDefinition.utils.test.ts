import { describe, expect, it } from 'vitest';
import type { OrdersV4ConversionVersion, OrdersV4Item, OrdersV4Unit } from '../../../types/api';
import {
  ordersV4CompatibleTargets,
  ordersV4CompositeQuantity,
  ordersV4DefinitionUnitIds,
  ordersV4OrderDefinitionRows,
} from './ordersV4ItemDefinition.utils';

const unit = (id: string, nameAr: string, dimension: string): OrdersV4Unit => ({
  id, code: id, nameAr, dimension, decimalScale: 3, isActive: true,
});
const carton = unit('carton', 'كرتون', 'package');
const box = unit('box', 'علبة', 'package');
const piece = unit('piece', 'حبة', 'count');
const kg = unit('kg', 'كيلوجرام', 'mass');
const liter = unit('l', 'لتر', 'volume');

describe('Orders V4 item definition UI model', () => {
  it('derives the ordered units from the chain', () => {
    expect(ordersV4DefinitionUnitIds([
      { key: '1', fromUnitId: carton.id, toUnitId: box.id, factor: '10' },
      { key: '2', fromUnitId: box.id, toUnitId: piece.id, factor: '64' },
    ])).toEqual(['carton', 'box', 'piece']);
    expect(ordersV4OrderDefinitionRows([
      { key: '2', fromUnitId: box.id, toUnitId: piece.id, factor: '64' },
      { key: '1', fromUnitId: carton.id, toUnitId: box.id, factor: '10' },
    ]).map((row) => row.key)).toEqual(['1', '2']);
  });

  it('offers compatible central units without cycles', () => {
    const rows = [{ key: '1', fromUnitId: carton.id, toUnitId: box.id, factor: '10' }];
    expect(ordersV4CompatibleTargets([carton, box, piece, kg, liter], rows, 0).map((row) => row.id))
      .toEqual(['box', 'piece', 'kg', 'l']);
  });

  it('formats the canonical stock as a composite quantity', () => {
    const item = {
      id: 'item', nameAr: 'مكوّن', itemType: 'purchased', inventoryUnitId: piece.id,
      inventoryUnit: piece, trackInventory: true, isActive: true, sections: [],
      units: [carton, box, piece].map((current, index) => ({
        id: `iu-${index}`, unitId: current.id, unit: current, isOrderEnabled: true, isActive: true, sortOrder: index,
      })),
    } as OrdersV4Item;
    const conversion = {
      id: 'v1', itemId: item.id, item, version: 1, status: 'published',
      edges: [
        { id: 'e1', fromUnitId: carton.id, toUnitId: box.id, factor: '10', reversible: true, allowDimensionBridge: false, fromUnit: carton, toUnit: box },
        { id: 'e2', fromUnitId: box.id, toUnitId: piece.id, factor: '64', reversible: true, allowDimensionBridge: true, fromUnit: box, toUnit: piece },
      ],
    } as OrdersV4ConversionVersion;
    expect(ordersV4CompositeQuantity('6400', item, conversion)).toEqual({ primary: '١٠ كرتون', base: '٦٬٤٠٠ حبة' });
    expect(ordersV4CompositeQuantity('6465', item, conversion)?.primary).toBe('١٠ كرتون + ١ علبة + ١ حبة');
  });
});
