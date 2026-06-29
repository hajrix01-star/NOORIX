import { describe, expect, it } from 'vitest';
import {
  buildStaffOrderFrequencyMap,
  buildStaffOrderPayload,
  buildStaffQtyMap,
  filterStaffOrderProducts,
  groupSentSaleOrders,
  mapStaffOrderToBasketLines,
  summarizeSentSales,
  upsertPlainStaffBasketLine,
} from './staffOrderPanelModel';

describe('staffOrderPanelModel', () => {
  it('filters products by section/search and sorts by frequency then localized name', () => {
    const freqMap = buildStaffOrderFrequencyMap(
      [
        { orderType: 'sale', items: [{ productId: 'p2' }, { productId: 'p2' }] },
        { orderType: 'order', items: [{ productId: 'p1' }] },
      ],
      'sale',
    );
    const products = filterStaffOrderProducts({
      allProducts: [
        { id: 'p1', nameAr: 'تفاح', nameEn: 'Apple', sections: ['fresh'] },
        { id: 'p2', nameAr: 'موز', nameEn: 'Banana', sections: ['fresh'] },
        { id: 'p3', nameAr: 'قهوة', nameEn: 'Coffee', sections: ['dry'] },
      ],
      sectionFilter: 'fresh',
      search: '',
      freqMap,
      lang: 'en',
    });
    expect(products.map((p) => p.id)).toEqual(['p2', 'p1']);
  });

  it('groups sent sales by log ref and summarizes totals by operation count', () => {
    const groups = groupSentSaleOrders(
      [
        { id: 'old', logRef: 'L1', createdAt: '2026-06-01', items: [{ quantity: 1, unitPrice: '10' }] },
        { id: 'new', logRef: 'L2', createdAt: '2026-06-02', items: [{ quantity: 2, unitPrice: '5' }] },
      ],
      true,
    );
    expect(groups.map((group) => group[0].logRef)).toEqual(['L2', 'L1']);
    const summary = summarizeSentSales({ isSale: true, sentSaleGroups: groups, sentOrders: groups.flat() });
    expect(summary.operationCount).toBe(2);
    expect(summary.totalQty).toBe(3);
    expect(summary.totalAmount.toNumber()).toBe(20);
    expect(summary.avgPerOrder.toNumber()).toBe(10);
  });

  it('maps editing items and quantity maps without mutating basket lines', () => {
    const lines = mapStaffOrderToBasketLines({
      sectionName: 'fresh',
      items: [{ productId: 'p1', quantity: '3', unit: 'box', unitPrice: '7.5' }],
    });
    expect(lines[0]).toMatchObject({ productId: 'p1', quantity: 3, unit: 'box', sectionName: 'fresh' });
    expect(buildStaffQtyMap([...lines, { ...lines[0], lineId: 'other', quantity: 2 }]).get('p1')).toBe(5);
  });

  it('upserts plain basket lines and builds submit payloads', () => {
    const product = { id: 'p1', unit: 'piece', lastPrice: '12', sections: ['fresh'] };
    const lines = upsertPlainStaffBasketLine({
      currentLines: [],
      product,
      qty: 2,
      unit: 'piece',
      sectionFilter: 'fresh',
      lineId: 'line-1',
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ productId: 'p1', quantity: 2, unitPrice: '12' });
    const payload = buildStaffOrderPayload({
      companyId: 'c1',
      productType: 'sale',
      isSale: true,
      saleDate: '2026-06-29',
      lang: 'ar',
      notes: '  note ',
      basketLines: lines,
      productsById: new Map([['p1', product]]),
      sectionFilter: 'fresh',
      editingId: 'order-1',
    });
    expect(payload).toMatchObject({ companyId: 'c1', orderType: 'sale', saleDate: '2026-06-29', notes: 'note', sectionName: 'fresh' });
    expect((payload.items as any[])[0]).toMatchObject({ productId: 'p1', quantity: '2', unitPrice: '12' });
  });
});
