import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calculateOrdersV4Issue, calculateOrdersV4LastFiveAverage, calculateOrdersV4Line, calculateOrdersV4Receipt } from './orders-v4-calculation.kernel';
import { resolveOrdersV4Conversion, validateOrdersV4ConversionDefinition } from './orders-v4-conversion.kernel';
import type { OrdersV4ConversionEdgeDefinition, OrdersV4UnitDefinition } from './orders-v4-kernel.types';

const units: OrdersV4UnitDefinition[] = [
  { id: 'piece', code: 'piece', dimension: 'count', canonicalFactor: new Prisma.Decimal(1) },
  { id: 'pack', code: 'pack', dimension: 'package', canonicalFactor: null },
  { id: 'carton', code: 'carton', dimension: 'package', canonicalFactor: null },
  { id: 'kg', code: 'kg', dimension: 'mass', canonicalFactor: new Prisma.Decimal(1000) },
  { id: 'g', code: 'g', dimension: 'mass', canonicalFactor: new Prisma.Decimal(1) },
];

const edges: OrdersV4ConversionEdgeDefinition[] = [
  { id: 'carton-pack', fromUnitId: 'carton', toUnitId: 'pack', factor: new Prisma.Decimal(12), reversible: true, allowDimensionBridge: false },
  { id: 'pack-piece', fromUnitId: 'pack', toUnitId: 'piece', factor: new Prisma.Decimal(24), reversible: true, allowDimensionBridge: true },
];

describe('Orders Core V4 kernel', () => {
  it('uses only the latest five normalized purchase prices for recipe costing', () => {
    expect(calculateOrdersV4LastFiveAverage(['10', '20', '30', '40', '50', '999']).toString()).toBe('30');
    expect(calculateOrdersV4LastFiveAverage([]).toString()).toBe('0');
  });
  it('resolves an item packaging chain to its base unit', () => {
    const resolved = resolveOrdersV4Conversion({ fromUnitId: 'carton', toUnitId: 'piece', units, edges });
    expect(resolved.factor.toString()).toBe('288');
    expect(resolved.source).toBe('item-definition');
    expect(resolved.path).toHaveLength(2);
  });

  it('uses canonical conversions only within the same dimension', () => {
    const resolved = resolveOrdersV4Conversion({ fromUnitId: 'kg', toUnitId: 'g', units, edges: [] });
    expect(resolved.factor.toString()).toBe('1000');
    expect(resolved.source).toBe('canonical');
  });

  it('rejects authored cycles and ambiguous conversion graphs', () => {
    expect(() => validateOrdersV4ConversionDefinition(units, [
      ...edges,
      { id: 'piece-carton', fromUnitId: 'piece', toUnitId: 'carton', factor: new Prisma.Decimal('0.003472222222'), reversible: false, allowDimensionBridge: true },
    ])).toThrow(BadRequestException);
  });

  it('calculates price-unit quantities on the server', () => {
    const inputConversion = resolveOrdersV4Conversion({ fromUnitId: 'carton', toUnitId: 'piece', units, edges });
    const priceConversion = resolveOrdersV4Conversion({ fromUnitId: 'pack', toUnitId: 'piece', units, edges });
    const line = calculateOrdersV4Line({ inputQuantity: 2, unitPrice: 15, inputConversion, priceConversion });
    expect(line.baseQuantity.toString()).toBe('576');
    expect(line.priceQuantity.toString()).toBe('24');
    expect(line.lineTotal.toString()).toBe('360');
  });

  it('owns weighted-average receipts and historical-cost issues', () => {
    const receipt = calculateOrdersV4Receipt({
      quantity: new Prisma.Decimal(10),
      value: new Prisma.Decimal(100),
      averageUnitCost: new Prisma.Decimal(10),
    }, { quantity: 10, totalValue: 300 });
    expect(receipt.averageUnitCostAfter.toString()).toBe('20');

    const issue = calculateOrdersV4Issue({
      quantity: receipt.quantityAfter,
      value: receipt.valueAfter,
      averageUnitCost: receipt.averageUnitCostAfter,
    }, { quantity: 4 });
    expect(issue.valueDelta.toString()).toBe('-80');
    expect(issue.quantityAfter.toString()).toBe('16');
  });
});

