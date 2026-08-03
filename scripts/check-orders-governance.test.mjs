import { describe, expect, it } from 'vitest';
import { findLegacyRuntimeReferences } from './orders-governance-rules.mjs';

describe('legacy Orders retirement governance', () => {
  it('rejects legacy permissions, delegates, routes, imports, and cutover runtime', () => {
    const source = `
      const permission = 'ORDERS_READ';
      prisma.staffOrder.findMany();
      import x from '../orders/orders.service';
      const route = '/orders';
      const cutover = new OrdersV4LegacyCutoverService();
    `;
    expect(findLegacyRuntimeReferences(source)).toEqual(expect.arrayContaining([
      'legacy permission ORDERS_READ',
      'legacy Prisma delegate staffOrder',
      'legacy Orders import',
      'legacy /orders route',
      'legacy cutover runtime',
    ]));
  });

  it('accepts the isolated Orders V4 runtime', () => {
    const source = `
      const permission = 'ORDERS_V4_READ';
      prisma.ordersV4Document.findMany();
      const route = '/orders-v4';
    `;
    expect(findLegacyRuntimeReferences(source)).toEqual([]);
  });
});
