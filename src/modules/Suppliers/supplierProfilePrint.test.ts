import { describe, expect, it } from 'vitest';
import {
  buildSupplierInvoicesPrintHtml,
  buildSupplierProfilePrintHtml,
} from './supplierProfilePrint';

const t = (key: string, ...args: string[]) => (args.length ? `${key}:${args.join(',')}` : key);

describe('supplier profile print model', () => {
  it('builds invoice print records through the central print table helper', () => {
    const html = buildSupplierInvoicesPrintHtml([
      { invoiceNumber: 'INV-1', transactionDate: '2026-07-07', netAmount: 100, taxAmount: 15, totalAmount: 115 },
    ], t);

    expect(html).toContain('INV-1');
    expect(html).toContain('115');
  });

  it('uses official summary totals instead of aggregating invoice rows', () => {
    const html = buildSupplierProfilePrintHtml({
      supplier: { id: 's1', nameAr: 'Supplier A', isTaxRegistered: true },
      invoices: [{ invoiceNumber: 'INV-1', netAmount: 1, taxAmount: 1, totalAmount: 1 }],
      summary: { count: 7, net: '1000', tax: '150', total: '1150' },
      lang: 'en',
      t,
    });

    expect(html).toContain('supplierProfile');
    expect(html).toContain('Supplier A');
    expect(html).toContain('1,150');
    expect(html).toContain('7');
  });
});
