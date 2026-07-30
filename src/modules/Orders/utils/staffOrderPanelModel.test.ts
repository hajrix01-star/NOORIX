import { describe, expect, it } from 'vitest';
import {
  buildStaffOrderFrequencyMap,
  buildStaffOrderPayload,
  buildStaffQtyMap,
  canMutateStaffSaleOrder,
  filterStaffOrderProducts,
  filterStaffSaleOrdersToRecentWeek,
  groupSentSaleOrders,
  latestEditableStaffSaleScope,
  mapStaffOrderToBasketLines,
  summarizeSentSales,
  upsertPlainStaffBasketLine,
} from './staffOrderPanelModel';
import type { OrderProduct, StaffOrder, StaffOrderItem } from '../../../types/api';

function staffItem(overrides: Partial<StaffOrderItem>): StaffOrderItem {
  return {
    productId: overrides.productId || 'p1',
    quantity: overrides.quantity ?? 1,
    unitPrice: overrides.unitPrice,
    unit: overrides.unit,
    ...overrides,
  };
}

function staffOrder(overrides: Partial<StaffOrder>): StaffOrder {
  return {
    id: overrides.id || 'order-1',
    companyId: 'company-1',
    sectionName: overrides.sectionName || 'fresh',
    orderType: overrides.orderType || 'order',
    status: overrides.status || 'sent',
    createdAt: overrides.createdAt || '2026-06-01',
    items: overrides.items ?? [],
    ...overrides,
  };
}

function product(overrides: Partial<OrderProduct>): OrderProduct {
  return {
    id: overrides.id || 'p1',
    nameAr: overrides.nameAr || 'Product',
    unit: overrides.unit,
    lastPrice: overrides.lastPrice,
    sections: overrides.sections,
    ...overrides,
  };
}

describe('staffOrderPanelModel', () => {
  it('filters products by section/search and sorts by frequency then localized name', () => {
    const freqMap = buildStaffOrderFrequencyMap(
      [
        staffOrder({ orderType: 'sale', items: [staffItem({ productId: 'p2' }), staffItem({ productId: 'p2' })] }),
        staffOrder({ orderType: 'order', items: [staffItem({ productId: 'p1' })] }),
      ],
      'sale',
    );
    const products = filterStaffOrderProducts({
      allProducts: [
        product({ id: 'p1', nameAr: 'Apple', nameEn: 'Apple', sections: ['fresh'] }),
        product({ id: 'p2', nameAr: 'Banana', nameEn: 'Banana', sections: ['fresh'] }),
        product({ id: 'p3', nameAr: 'Coffee', nameEn: 'Coffee', sections: ['dry'] }),
      ],
      sectionFilter: 'fresh',
      search: '',
      freqMap,
      lang: 'en',
    });
    expect(products.map((row) => row.id)).toEqual(['p2', 'p1']);
  });

  it('groups sent sales by log ref and summarizes totals by operation count', () => {
    const groups = groupSentSaleOrders(
      [
        staffOrder({ id: 'old', logRef: 'L1', createdAt: '2026-06-01', items: [staffItem({ productId: 'p1', quantity: 1, unitPrice: '10' })] }),
        staffOrder({ id: 'new', logRef: 'L2', createdAt: '2026-06-02', items: [staffItem({ productId: 'p1', quantity: 2, unitPrice: '5' })] }),
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
    const lines = mapStaffOrderToBasketLines(
      staffOrder({ sectionName: 'fresh', items: [staffItem({ productId: 'p1', quantity: '3', unit: 'box', unitPrice: '7.5' })] }),
    );
    expect(lines[0]).toMatchObject({ productId: 'p1', quantity: 3, unit: 'box', sectionName: 'fresh' });
    expect(buildStaffQtyMap([...lines, { ...lines[0], lineId: 'other', quantity: 2 }]).get('p1')).toBe(5);
  });

  it('upserts plain basket lines and builds submit payloads', () => {
    const baseProduct = product({ id: 'p1', unit: 'piece', lastPrice: '12', sections: ['fresh'] });
    const lines = upsertPlainStaffBasketLine({
      currentLines: [],
      product: baseProduct,
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
      productsById: new Map([['p1', baseProduct]]),
      sectionFilter: 'fresh',
      editingId: 'order-1',
    });
    expect(payload).toMatchObject({ companyId: 'c1', orderType: 'sale', saleDate: '2026-06-29', notes: 'note', sectionName: 'fresh' });
    expect(payload.items[0]).toMatchObject({ productId: 'p1', quantity: '2', unitPrice: '12' });
  });

  it('limits non-owner sale edits to the latest internal log scope', () => {
    const older = staffOrder({ id: 'old-section', orderType: 'sale', logRef: 'DS-001', createdAt: '2026-07-01' });
    const latest = staffOrder({ id: 'latest-section', orderType: 'sale', logRef: 'DS-002', createdAt: '2026-07-02' });
    const latestScope = latestEditableStaffSaleScope([older, latest]);

    expect(canMutateStaffSaleOrder({ order: older, latestScope, isPrivileged: false })).toBe(false);
    expect(canMutateStaffSaleOrder({ order: latest, latestScope, isPrivileged: false })).toBe(true);
    expect(canMutateStaffSaleOrder({ order: older, latestScope, isPrivileged: true })).toBe(true);
  });

  it('shows only the recent week in the internal sales history', () => {
    const visible = filterStaffSaleOrdersToRecentWeek(
      [
        staffOrder({ id: 'too-old', orderType: 'sale', createdAt: '2026-07-20T12:00:00.000Z' }),
        staffOrder({ id: 'old-sale-date', orderType: 'sale', saleDate: '2026-07-20', createdAt: '2026-07-30T09:00:00.000Z' }),
        staffOrder({ id: 'week-start', orderType: 'sale', createdAt: '2026-07-24T08:00:00.000Z' }),
        staffOrder({ id: 'today', orderType: 'sale', createdAt: '2026-07-30T09:00:00.000Z' }),
      ],
      new Date('2026-07-30T12:00:00.000Z'),
    );

    expect(visible.map((order) => order.id)).toEqual(['week-start', 'today']);
  });

  it('builds a cancellation payload with per-line reasons while keeping the entered quantity positive', () => {
    const baseProduct = product({ id: 'p1', unit: 'piece', sections: ['bar'] });
    const payload = buildStaffOrderPayload({
      companyId: 'c1',
      productType: 'sale',
      isSale: true,
      entryType: 'cancellation',
      saleDate: '2026-07-30',
      lang: 'ar',
      notes: '',
      basketLines: [{
        lineId: 'cancel-line-1',
        productId: 'p1',
        quantity: 2,
        unit: 'piece',
        size: '',
        packaging: '',
        unitPrice: '12',
        sectionName: 'bar',
        cancellationReasons: ['customer_disliked', 'replaced_item'],
        cancellationNote: '',
      }],
      productsById: new Map([['p1', baseProduct]]),
      sectionFilter: 'bar',
      editingId: null,
    });

    expect(payload.entryType).toBe('cancellation');
    expect(payload.items[0]).toMatchObject({
      productId: 'p1',
      quantity: '2',
      cancellationReasons: ['customer_disliked', 'replaced_item'],
    });
  });
});
