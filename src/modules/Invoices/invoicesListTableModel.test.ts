import { describe, it, expect } from 'vitest';
import {
  buildInvoiceListColumns,
  buildInvoiceListFooterRow,
  createInvoiceListMobileCardRenderer,
} from './invoicesListTableModel';

const noop = () => {};
const t = (k: any, ...args: any[]) => (args.length ? `${k}:${args.join(',')}` : k);

describe('invoicesListTableModel', () => {
  it('buildInvoiceListColumns returns stable column keys', () => {
    const cols = buildInvoiceListColumns({
      t,
      lang: 'ar',
      fmt: (n: any) => String(n),
      STATUS_MAP: {},
      KIND_MAP: {},
      userRole: 'admin',
      companyId: 'c1',
      setViewingInvoice: noop,
      setEditingInvoice: noop,
      confirmAndDeleteInvoice: noop,
    });
    expect(cols.map((c: any) => c.key)).toEqual([
      'invoiceNumber',
      'supplierInvoiceNumber',
      'supplierName',
      'createdByDisplayName',
      'notesOrEmployee',
      'kind',
      'vaultLabel',
      'netAmount',
      'taxAmount',
      'totalAmount',
      'transactionDate',
      'status',
      'actions',
    ]);
  });

  it('buildInvoiceListFooterRow returns four row segments', () => {
    const foot = buildInvoiceListFooterRow({
      t,
      serverAll: { count: 3, net: 1, tax: 2, total: 3 },
      total: 100,
    });
    expect(foot).toHaveLength(4);
    expect(foot[0].keys).toContain('invoiceNumber');
  });

  it('createInvoiceListMobileCardRenderer returns a function', () => {
    const fn = createInvoiceListMobileCardRenderer({
      t,
      lang: 'ar',
      STATUS_MAP: {},
      KIND_MAP: {},
      userRole: 'admin',
      companyId: 'c1',
      setEditingInvoice: noop,
      confirmAndDeleteInvoice: noop,
    });
    expect(typeof fn).toBe('function');
  });
});
