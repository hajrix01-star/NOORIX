import { describe, expect, it } from 'vitest';
import {
  buildSingleOrderExportRows,
  computeCashSalesTotal,
  computeCumulativeRemainingByOrderId,
  computeOrdersSummaryForRange,
  filterOrdersByDate,
  mergeOrderCatalogProducts,
  resolveOrdersDateRange,
} from './ordersTabModel';

const t = (key: string) => key;

describe('ordersTabModel', () => {
  it('resolves month ranges and filters orders by date', () => {
    expect(resolveOrdersDateRange({ year: 2026, month: 2 })).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
    const orders = [
      { id: 'a', orderDate: '2026-02-01T10:00:00.000Z' },
      { id: 'b', orderDate: '2026-03-01' },
    ];
    expect(filterOrdersByDate(orders, '2026-02-01', '2026-02-28').map((o) => o.id)).toEqual(['a']);
  });

  it('uses API summary for full month and local summary for custom ranges', () => {
    const apiSummary = { pettyCashTotal: 999 };
    const orders = [
      { orderType: 'external', pettyCashAmount: 100, totalAmount: 80 },
      { orderType: 'internal', totalAmount: 40 },
    ];
    expect(
      computeOrdersSummaryForRange({
        summaryFromApi: apiSummary,
        dateFilteredOrders: orders,
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        year: 2026,
        month: 6,
      }),
    ).toBe(apiSummary);
    expect(
      computeOrdersSummaryForRange({
        summaryFromApi: apiSummary,
        dateFilteredOrders: orders,
        startDate: '2026-06-10',
        endDate: '2026-06-20',
        year: 2026,
        month: 6,
      }),
    ).toMatchObject({ pettyCashTotal: 100, delegatePurchasesTotal: 80, delegateBalance: 20, localPurchasesTotal: 40 });
  });

  it('tracks cumulative external delegate remaining by order id', () => {
    const map = computeCumulativeRemainingByOrderId([
      { id: 'b', orderType: 'external', orderDate: '2026-06-02', pettyCashAmount: 50, totalAmount: 75 },
      { id: 'a', orderType: 'external', orderDate: '2026-06-01', pettyCashAmount: 100, totalAmount: 60 },
      { id: 'c', orderType: 'internal', orderDate: '2026-06-03', totalAmount: 10 },
    ]);
    expect(map.get('a')).toBe(40);
    expect(map.get('b')).toBe(15);
    expect(map.has('c')).toBe(false);
  });

  it('merges editing line products into the catalog', () => {
    const products = mergeOrderCatalogProducts(
      [{ id: 'p1', nameAr: 'A' }],
      { items: [{ product: { id: 'p2', nameAr: 'B' } }, { product: { id: 'p1', nameAr: 'A old' } }] },
    );
    expect(products.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('computes cash-only sales totals and export fallback rows', () => {
    expect(
      computeCashSalesTotal({
        items: [
          { channels: [{ vault: { type: 'cash' }, amount: 30 }, { vault: { type: 'bank' }, amount: 20 }] },
          { channels: [{ vault: { type: 'cash' }, amount: 7 }] },
        ],
      }),
    ).toBe(37);
    const rows = buildSingleOrderExportRows({ orderNumber: 'O-1', orderDate: '2026-06-01', orderType: 'internal', totalAmount: 55, items: [] }, t);
    expect(rows).toHaveLength(1);
    expect(rows[0].product).toBe('—');
  });
});
