import { describe, expect, it } from 'vitest';
import type { OrderItemsReportRow } from '../../../types/api';
import {
  computeItemsReportMetrics,
  filterItemsReportRows,
  rankItemsReportRows,
} from './itemsReportViewModel';

const rows: OrderItemsReportRow[] = [
  {
    productId: 'charcoal',
    productNameAr: 'فحم',
    categoryId: 'charcoal-category',
    categoryNameAr: 'فحم',
    sectionName: 'شيشة',
    sectionNames: ['شيشة'],
    unit: 'carton',
    baseUnit: 'pack',
    packaging: 'كرتون',
    quantity: 2,
    normalizedQuantity: 20,
    amount: 200,
    orderCount: 2,
    orderIds: ['o1', 'o2'],
    orderTypes: ['external'],
  },
  {
    productId: 'mint',
    productNameAr: 'نعناع',
    categoryId: 'vegetables',
    categoryNameAr: 'خضار',
    sectionName: 'مطبخ',
    sectionNames: ['مطبخ'],
    unit: 'kg',
    baseUnit: 'kg',
    quantity: 3,
    normalizedQuantity: 3,
    amount: 30,
    orderCount: 1,
    orderIds: ['o2'],
    orderTypes: ['internal'],
  },
];

describe('itemsReportViewModel', () => {
  it('filters by section and order type', () => {
    const filtered = filterItemsReportRows(rows, {
      search: '',
      sections: ['شيشة'],
      categoryIds: [],
      units: [],
      packagings: [],
      orderTypes: ['external'],
    });
    expect(filtered.map((row) => row.productId)).toEqual(['charcoal']);
  });

  it('uses distinct orders and keeps normalized quantities separated by base unit', () => {
    const metrics = computeItemsReportMetrics(rows);
    expect(metrics.amount).toBe(230);
    expect(metrics.distinctOrders).toBe(2);
    expect(metrics.distinctProducts).toBe(2);
    expect(Object.fromEntries(metrics.quantityByBaseUnit)).toEqual({ pack: 20, kg: 3 });
  });

  it('ranks by the selected metric', () => {
    expect(rankItemsReportRows(rows, 'amount', 'top', 1)[0].productId).toBe('charcoal');
    expect(rankItemsReportRows(rows, 'amount', 'bottom', 1)[0].productId).toBe('mint');
  });
});
