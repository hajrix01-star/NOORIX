import { describe, expect, it } from 'vitest';
import type { OrdersV4Document } from '../../../types/api';
import { buildOrdersV4PeriodCustodyBalances } from './ordersV4CustodyPeriod.utils';

function document(overrides: Partial<OrdersV4Document>): OrdersV4Document {
  return {
    id: 'document-1',
    documentNumber: 'V4-1',
    documentType: 'purchase',
    status: 'received',
    paymentMethod: 'custody',
    documentDate: '2026-08-01',
    createdAt: '2026-08-01T09:00:00.000Z',
    locationId: 'location-1',
    subtotal: '0',
    totalAmount: '0',
    operationalCost: '0',
    location: { id: 'location-1', code: 'main', nameAr: 'المخزون الرئيسي', kind: 'central', isActive: true },
    lines: [],
    ...overrides,
  } as OrdersV4Document;
}

describe('buildOrdersV4PeriodCustodyBalances', () => {
  it('starts from zero for the supplied period and follows the legacy date order', () => {
    const balances = buildOrdersV4PeriodCustodyBalances([
      document({ id: 'second', documentDate: '2026-08-02', pettyCashAmount: '50', totalAmount: '75' }),
      document({ id: 'first', documentDate: '2026-08-01', pettyCashAmount: '100', totalAmount: '60' }),
    ]);

    expect(balances.get('first')).toBe(40);
    expect(balances.get('second')).toBe(15);
  });

  it('excludes non-custody, prepared, and reversed documents', () => {
    const balances = buildOrdersV4PeriodCustodyBalances([
      document({ id: 'cash', paymentMethod: 'cash', pettyCashAmount: null, totalAmount: '30' }),
      document({ id: 'prepared', status: 'prepared', pettyCashAmount: '100', totalAmount: '20' }),
      document({ id: 'reversed', status: 'reversed', pettyCashAmount: '100', totalAmount: '20' }),
    ]);

    expect([...balances]).toEqual([]);
  });
});
