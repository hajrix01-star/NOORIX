import { describe, expect, it } from 'vitest';
import {
  buildSingleOrderExportRows,
  computeCumulativeRemainingByOrderId,
  filterOrdersByDate,
  mergeOrderCatalogProducts,
  resolveOrdersDateRange,
} from './ordersTabModel';
import type { OrderLine, OrderRecord } from '../../../types/api';

const t = (key: string) => key;

function order(overrides: Partial<OrderRecord>): OrderRecord {
  return {
    id: overrides.id || 'order-1',
    companyId: 'company-1',
    orderNumber: overrides.orderNumber || 'O-1',
    orderDate: overrides.orderDate || '2026-06-01',
    orderType: overrides.orderType || 'external',
    pettyCashAmount: overrides.pettyCashAmount,
    totalAmount: overrides.totalAmount ?? 0,
    items: overrides.items ?? [],
    ...overrides,
  };
}

function line(overrides: Partial<OrderLine>): OrderLine {
  return {
    productId: overrides.productId || 'p1',
    quantity: overrides.quantity ?? 1,
    unitPrice: overrides.unitPrice ?? 1,
    amount: overrides.amount ?? 1,
    ...overrides,
  };
}

describe('ordersTabModel', () => {
  it('resolves month ranges and filters orders by date', () => {
    expect(resolveOrdersDateRange({ year: 2026, month: 2 })).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
    const orders = [
      order({ id: 'a', orderDate: '2026-02-01T10:00:00.000Z' }),
      order({ id: 'b', orderDate: '2026-03-01' }),
    ];
    expect(filterOrdersByDate(orders, '2026-02-01', '2026-02-28').map((row) => row.id)).toEqual(['a']);
  });

  it('normalizes date-filter timestamps before calling strict range APIs', () => {
    expect(resolveOrdersDateRange({
      year: 2026,
      month: 7,
      propStartDate: '2026-07-01T00:00:00+03:00',
      propEndDate: '2026-07-31T23:59:59+03:00',
    })).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });
  });

  it('tracks cumulative external delegate remaining by order id', () => {
    const map = computeCumulativeRemainingByOrderId([
      order({ id: 'b', orderType: 'external', orderDate: '2026-06-02', pettyCashAmount: 50, totalAmount: 75 }),
      order({ id: 'a', orderType: 'external', orderDate: '2026-06-01', pettyCashAmount: 100, totalAmount: 60 }),
      order({ id: 'c', orderType: 'internal', orderDate: '2026-06-03', totalAmount: 10 }),
    ]);
    expect(map.get('a')).toBe(40);
    expect(map.get('b')).toBe(15);
    expect(map.has('c')).toBe(false);
  });

  it('merges editing line products into the catalog', () => {
    const products = mergeOrderCatalogProducts(
      [{ id: 'p1', nameAr: 'A' }],
      order({ items: [line({ productId: 'p2', product: { id: 'p2', nameAr: 'B' } }), line({ productId: 'p1', product: { id: 'p1', nameAr: 'A old' } })] }),
    );
    expect(products.map((product) => product.id)).toEqual(['p1', 'p2']);
  });

  it('builds export fallback rows', () => {
    const rows = buildSingleOrderExportRows(
      order({ orderNumber: 'O-1', orderDate: '2026-06-01', orderType: 'internal', totalAmount: 55, items: [] }),
      t,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].product).toBe('—');
  });
});
