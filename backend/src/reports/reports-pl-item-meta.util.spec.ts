import Decimal from 'decimal.js';
import { resolvePlItemMeta } from './reports-pl-item-meta.util';
import type { CategoryNode, ReportInvoice } from './reports-general-profit-loss-model.util';

const invoice = (overrides: Partial<ReportInvoice> = {}): ReportInvoice => ({
  id: 'invoice-1',
  invoiceNumber: 'PUR-1',
  supplierInvoiceNumber: null,
  kind: 'expense',
  totalAmount: new Decimal(525),
  netAmount: new Decimal(525),
  taxAmount: new Decimal(0),
  transactionDate: new Date('2026-07-31T00:00:00.000Z'),
  notes: null,
  categoryId: null,
  supplier: null,
  expenseLine: null,
  dailySalesSummary: null,
  ...overrides,
});

describe('resolvePlItemMeta', () => {
  it('uses the invoice category over an outdated supplier category', () => {
    const categories = new Map<string, CategoryNode>([
      ['food', { id: 'food', nameAr: 'مواد غذائية', nameEn: 'Food', parentId: null, sortOrder: 1 }],
      ['maintenance', { id: 'maintenance', nameAr: 'صيانة', nameEn: 'Maintenance', parentId: null, sortOrder: 2 }],
    ]);

    const result = resolvePlItemMeta(invoice({
      categoryId: 'maintenance',
      supplier: { nameAr: 'NO NAME', supplierCategoryId: 'food' },
    }), 'expenses', categories);

    expect(result).toMatchObject({ key: 'category:maintenance', labelAr: 'صيانة' });
  });

  it('falls back to the supplier category only for legacy invoices without a category', () => {
    const categories = new Map<string, CategoryNode>([
      ['food', { id: 'food', nameAr: 'مواد غذائية', nameEn: 'Food', parentId: null, sortOrder: 1 }],
    ]);

    const result = resolvePlItemMeta(invoice({
      supplier: { nameAr: 'NO NAME', supplierCategoryId: 'food' },
    }), 'expenses', categories);

    expect(result).toMatchObject({ key: 'category:food', labelAr: 'مواد غذائية' });
  });
});