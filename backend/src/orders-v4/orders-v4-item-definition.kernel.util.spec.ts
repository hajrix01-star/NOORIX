import { Prisma } from '@prisma/client';
import { normalizeOrdersV4ItemDefinition } from './orders-v4-item-definition.kernel';

const units = [
  { id: 'carton', code: 'carton', dimension: 'package', canonicalFactor: null },
  { id: 'box', code: 'box', dimension: 'package', canonicalFactor: null },
  { id: 'piece', code: 'piece', dimension: 'count', canonicalFactor: new Prisma.Decimal(1) },
  { id: 'kg', code: 'kg', dimension: 'mass', canonicalFactor: new Prisma.Decimal(1000) },
  { id: 'l', code: 'l', dimension: 'volume', canonicalFactor: new Prisma.Decimal(1000) },
];

describe('Orders V4 item definition kernel', () => {
  it('normalizes a linear packaging chain and derives its units', () => {
    const result = normalizeOrdersV4ItemDefinition(units, {
      inventoryUnitId: 'piece',
      edges: [
        { fromUnitId: 'carton', toUnitId: 'box', factor: '10' },
        { fromUnitId: 'box', toUnitId: 'piece', factor: '64' },
      ],
      units: [{ unitId: 'carton', isOrderEnabled: true, lastPrice: '100' }],
    });
    expect(result.unitIds).toEqual(['carton', 'box', 'piece']);
    expect(result.edges[1].allowDimensionBridge).toBe(true);
  });

  it('supports a one-unit item without a conversion edge', () => {
    const result = normalizeOrdersV4ItemDefinition(units, {
      inventoryUnitId: 'piece', edges: [], units: [{ unitId: 'piece', isOrderEnabled: true }],
    });
    expect(result.unitIds).toEqual(['piece']);
    expect(result.edges).toEqual([]);
  });

  it('rejects a disconnected or cyclic chain', () => {
    expect(() => normalizeOrdersV4ItemDefinition(units, {
      inventoryUnitId: 'piece',
      edges: [
        { fromUnitId: 'carton', toUnitId: 'box', factor: '10' },
        { fromUnitId: 'carton', toUnitId: 'piece', factor: '64' },
      ], units: [],
    })).toThrow('غير متصل');
    expect(() => normalizeOrdersV4ItemDefinition(units, {
      inventoryUnitId: 'carton',
      edges: [
        { fromUnitId: 'carton', toUnitId: 'box', factor: '10' },
        { fromUnitId: 'box', toUnitId: 'carton', factor: '64' },
      ], units: [],
    })).toThrow('مكررة');
  });

  it('blocks direct mass-to-volume bridges and price units outside the chain', () => {
    expect(() => normalizeOrdersV4ItemDefinition(units, {
      inventoryUnitId: 'l', edges: [{ fromUnitId: 'kg', toUnitId: 'l', factor: '1' }], units: [],
    })).toThrow('وحدة تغليف وسيطة');
    expect(() => normalizeOrdersV4ItemDefinition(units, {
      inventoryUnitId: 'piece', edges: [], units: [{ unitId: 'carton', isOrderEnabled: true }],
    })).toThrow('سلسلة وحدات الصنف');
  });
});
