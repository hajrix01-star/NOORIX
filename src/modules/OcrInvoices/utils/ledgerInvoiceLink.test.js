import { describe, it, expect } from 'vitest';
import { invoicesHrefForLinkedPurchase } from './ledgerInvoiceLink';

describe('invoicesHrefForLinkedPurchase', () => {
  it('returns kind-only when no row id', () => {
    expect(invoicesHrefForLinkedPurchase(null)).toBe('/invoices?kind=purchase');
    expect(invoicesHrefForLinkedPurchase({})).toBe('/invoices?kind=purchase');
  });

  it('includes from/to when transactionDate is ISO', () => {
    expect(
      invoicesHrefForLinkedPurchase({
        id: 'inv1',
        transactionDate: '2026-04-20T00:00:00.000Z',
      }),
    ).toBe('/invoices?from=2026-04-20&to=2026-04-20&kind=purchase');
  });

  it('falls back to kind-only when date missing', () => {
    expect(invoicesHrefForLinkedPurchase({ id: 'x' })).toBe('/invoices?kind=purchase');
  });
});
