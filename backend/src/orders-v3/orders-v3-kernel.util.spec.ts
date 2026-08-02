import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calculateOrdersV3Issue, calculateOrdersV3Line, calculateOrdersV3Receipt } from './orders-v3-calculation.kernel';
import { resolveOrdersV3Conversion, validateOrdersV3ConversionDefinition } from './orders-v3-conversion.kernel';
import type { OrdersV3ConversionEdgeDefinition, OrdersV3UnitDefinition } from './orders-v3-kernel.types';

const units: OrdersV3UnitDefinition[] = [
  { id: 'piece', code: 'piece', dimension: 'count', canonicalFactor: new Prisma.Decimal(1) },
  { id: 'pack', code: 'pack', dimension: 'package', canonicalFactor: null },
  { id: 'carton', code: 'carton', dimension: 'package', canonicalFactor: null },
  { id: 'kg', code: 'kg', dimension: 'mass', canonicalFactor: new Prisma.Decimal(1000) },
  { id: 'g', code: 'g', dimension: 'mass', canonicalFactor: new Prisma.Decimal(1) },
];

const edges: OrdersV3ConversionEdgeDefinition[] = [
  { id: 'carton-pack', fromUnitId: 'carton', toUnitId: 'pack', factor: new Prisma.Decimal(12), reversible: true, allowDimensionBridge: false },
  { id: 'pack-piece', fromUnitId: 'pack', toUnitId: 'piece', factor: new Prisma.Decimal(24), reversible: true, allowDimensionBridge: true },
];

describe('Orders Core V3 kernel', () => {
  it('resolves an item packaging chain to its base unit', () => {
    const resolved = resolveOrdersV3Conversion({ fromUnitId: 'carton', toUnitId: 'piece', units, edges });
    expect(resolved.factor.toString()).toBe('288');
    expect(resolved.source).toBe('item-definition');
    expect(resolved.path).toHaveLength(2);
  });

  it('uses canonical conversions only within the same dimension', () => {
    const resolved = resolveOrdersV3Conversion({ fromUnitId: 'kg', toUnitId: 'g', units, edges: [] });
    expect(resolved.factor.toString()).toBe('1000');
    expect(resolved.source).toBe('canonical');
  });

  it('rejects authored cycles and ambiguous conversion graphs', () => {
    expect(() => validateOrdersV3ConversionDefinition(units, [
      ...edges,
      { id: 'piece-carton', fromUnitId: 'piece', toUnitId: 'carton', factor: new Prisma.Decimal('0.003472222222'), reversible: false, allowDimensionBridge: true },
    ])).toThrow(BadRequestException);
  });

  it('calculates price-unit quantities on the server', () => {
    const inputConversion = resolveOrdersV3Conversion({ fromUnitId: 'carton', toUnitId: 'piece', units, edges });
    const priceConversion = resolveOrdersV3Conversion({ fromUnitId: 'pack', toUnitId: 'piece', units, edges });
    const line = calculateOrdersV3Line({ inputQuantity: 2, unitPrice: 15, inputConversion, priceConversion });
    expect(line.baseQuantity.toString()).toBe('576');
    expect(line.priceQuantity.toString()).toBe('24');
    expect(line.lineTotal.toString()).toBe('360');
  });

  it('owns weighted-average receipts and historical-cost issues', () => {
    const receipt = calculateOrdersV3Receipt({
      quantity: new Prisma.Decimal(10),
      value: new Prisma.Decimal(100),
      averageUnitCost: new Prisma.Decimal(10),
    }, { quantity: 10, totalValue: 300 });
    expect(receipt.averageUnitCostAfter.toString()).toBe('20');

    const issue = calculateOrdersV3Issue({
      quantity: receipt.quantityAfter,
      value: receipt.valueAfter,
      averageUnitCost: receipt.averageUnitCostAfter,
    }, { quantity: 4 });
    expect(issue.valueDelta.toString()).toBe('-80');
    expect(issue.quantityAfter.toString()).toBe('16');
  });
});
