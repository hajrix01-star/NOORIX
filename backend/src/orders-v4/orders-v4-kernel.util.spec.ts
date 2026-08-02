import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  calculateOrdersV4ConvertedUnitPrice,
  calculateOrdersV4Issue,
  calculateOrdersV4LastFiveAverage,
  calculateOrdersV4Line,
  calculateOrdersV4Receipt,
  calculateOrdersV4RecipeComponentCost,
  calculateOrdersV4RecipeUsage,
  calculateOrdersV4Reversal,
  calculateOrdersV4UnitRebase,
} from './orders-v4-calculation.kernel';
import { resolveOrdersV4Conversion, validateOrdersV4ConversionDefinition } from './orders-v4-conversion.kernel';
import { ordersV4DateOnly, ordersV4RangeBounds } from './orders-v4-date.util';
import type { OrdersV4ConversionEdgeDefinition, OrdersV4UnitDefinition } from './orders-v4-kernel.types';
import { assertOrdersV4UnitDeactivationAllowed } from './orders-v4-unit-governance.kernel';
import { decideOrdersV4VersionPublication, ordersV4StableHash } from './orders-v4-version.kernel';

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
  it('accepts the shared ISO date filter while storing date-only boundaries', () => {
    expect(ordersV4DateOnly('2026-08-01T00:00:00+03:00', 'date').toISOString()).toBe('2026-08-01T00:00:00.000Z');
    const range = ordersV4RangeBounds('2026-08-01T00:00:00+03:00', '2026-08-31T23:59:59+03:00');
    expect(range.gte?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(range.lte?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });
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

  it('normalizes historical prices before calculating the last-five average', () => {
    const cartonToPiece = resolveOrdersV4Conversion({ fromUnitId: 'carton', toUnitId: 'piece', units, edges });
    const normalized = calculateOrdersV4ConvertedUnitPrice('288', cartonToPiece);
    expect(normalized.toString()).toBe('1');
  });

  it('owns recipe quantity and cost arithmetic across multi-level units', () => {
    const outputConversion = resolveOrdersV4Conversion({ fromUnitId: 'carton', toUnitId: 'piece', units, edges });
    const componentConversion = resolveOrdersV4Conversion({ fromUnitId: 'pack', toUnitId: 'piece', units, edges });
    const usage = calculateOrdersV4RecipeUsage({
      registeredBaseQuantity: '576',
      recipeOutputQuantity: '2',
      outputConversion,
      componentQuantity: '2',
      componentConversion,
    });
    expect(usage.batches.toString()).toBe('1');
    expect(usage.issueQuantity.toString()).toBe('48');
    expect(calculateOrdersV4RecipeComponentCost(usage.issueQuantity, '1.5').toString()).toBe('72');
  });

  it('rebases quantity and average cost while preserving inventory value', () => {
    const cartonToPiece = resolveOrdersV4Conversion({ fromUnitId: 'carton', toUnitId: 'piece', units, edges });
    const rebased = calculateOrdersV4UnitRebase({
      quantity: new Prisma.Decimal(2),
      value: new Prisma.Decimal(576),
      averageUnitCost: new Prisma.Decimal(288),
    }, cartonToPiece);
    expect(rebased.quantityAfter.toString()).toBe('576');
    expect(rebased.valueAfter.toString()).toBe('576');
    expect(rebased.averageUnitCostAfter.toString()).toBe('1');
  });

  it('reverses historical entries safely after an inventory-unit rebase', () => {
    const cartonToPiece = resolveOrdersV4Conversion({ fromUnitId: 'carton', toUnitId: 'piece', units, edges });
    const reversed = calculateOrdersV4Reversal({
      quantity: new Prisma.Decimal(576),
      value: new Prisma.Decimal(576),
      averageUnitCost: new Prisma.Decimal(1),
    }, {
      quantityDelta: new Prisma.Decimal(2),
      valueDelta: new Prisma.Decimal(576),
      unitCost: new Prisma.Decimal(288),
    }, cartonToPiece.factor);
    expect(reversed.quantityDelta.toString()).toBe('-576');
    expect(reversed.valueDelta.toString()).toBe('-576');
    expect(reversed.quantityAfter.toString()).toBe('0');
    expect(reversed.valueAfter.toString()).toBe('0');
  });

  it('publishes a fresh version when reverting from B back to a retired A definition', () => {
    const definitionA = [{ fromUnitId: 'carton', toUnitId: 'piece', factor: '288' }];
    const semanticHashA = ordersV4StableHash(definitionA);
    const reverted = decideOrdersV4VersionPublication({
      currentDefinition: [{ fromUnitId: 'carton', toUnitId: 'piece', factor: '300' }],
      candidateDefinition: definitionA,
      semanticHash: semanticHashA,
      hashAlreadyExists: true,
      predecessorVersionId: 'version-b',
      nextVersion: 3,
    });
    expect(reverted.reuseCurrent).toBe(false);
    expect(reverted.contentHash).not.toBe(semanticHashA);

    const repeated = decideOrdersV4VersionPublication({
      currentDefinition: definitionA,
      candidateDefinition: definitionA,
      semanticHash: semanticHashA,
      hashAlreadyExists: true,
      predecessorVersionId: 'version-a2',
      nextVersion: 4,
    });
    expect(repeated.reuseCurrent).toBe(true);
  });

  it('blocks deactivation of any referenced unit and permits an unused unit', () => {
    expect(() => assertOrdersV4UnitDeactivationAllowed([0, 0, 1, 0])).toThrow(BadRequestException);
    expect(() => assertOrdersV4UnitDeactivationAllowed([0, 0, 0])).not.toThrow();
    expect(() => assertOrdersV4UnitDeactivationAllowed([0, 0, 0], { isDefault: true })).toThrow('لا يمكن تعطيل أو حذف وحدة افتراضية');
  });
});

