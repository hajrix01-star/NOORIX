import { describe, it, expect } from 'vitest';
import {
  buildInvoiceListColumns,
  buildInvoiceListFooterRow,
  createInvoiceListMobileCardRenderer,
} from './invoicesListTableModel';

const noop = () => {};
const t = (key: string, ...args: unknown[]) => (args.length ? `${key}:${args.join(',')}` : key);

describe('invoicesListTableModel', () => {
  it('buildInvoiceListColumns returns stable column keys', () => {
    const cols = buildInvoiceListColumns({
      t,
      lang: 'ar',
      fmt: (value: number) => String(value),
      STATUS_MAP: {},
      KIND_MAP: {},
      userRole: 'admin',
      companyId: 'c1',
      setViewingInvoice: noop,
      setEditingInvoice: noop,
      printInvoice: noop,
      confirmAndDeleteInvoice: noop,
    });
    expect(cols.map((column) => column.key)).toEqual([
      'invoiceNumber',
      'supplierInvoiceNumber',
      'supplierName',
      'kind',
      'vaultLabel',
      'netAmount',
      'taxAmount',
      'totalAmount',
      'notesOrEmployee',
      'createdByDisplayName',
    ]);
    expect(cols.find((column) => column.key === 'invoiceNumber')?.size).toBe('document');
    expect(cols.find((column) => column.key === 'taxAmount')?.size).toBe('tax');
    expect(cols.find((column) => column.key === 'netAmount')?.size).toBe('money-sm');
    expect(cols.find((column) => column.key === 'totalAmount')?.size).toBe('money-md');
  });

  it('buildInvoiceListFooterRow returns five row segments', () => {
    const foot = buildInvoiceListFooterRow({
      t,
      serverAll: { count: 3, net: 1, tax: 2, total: 3 },
      total: 100,
    });
    expect(foot).toHaveLength(5);
    expect(foot[0].keys).toContain('invoiceNumber');
    expect(foot[4].keys).toEqual(['notesOrEmployee', 'createdByDisplayName']);
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
      printInvoice: noop,
      confirmAndDeleteInvoice: noop,
    });
    expect(typeof fn).toBe('function');
  });
});
