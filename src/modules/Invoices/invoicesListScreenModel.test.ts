import { describe, expect, it } from 'vitest';
import {
  buildInvoiceImportSuccessMessage,
  filterInvoiceSupplierCategories,
  getInvoiceListCreatedByDisplayName,
  getInvoiceListErrorMessage,
  mapInvoicesToListTableRows,
  normalizeInvoiceCreatorFilterOptions,
  resolveInvoiceListCompanyDisplay,
  resolveInvoiceListVaultRowLabel,
  toInvoiceListViewSource,
} from './invoicesListScreenModel';

const t = (key: string) => (key === 'categoryTypeSale' ? 'Sales' : key);

describe('invoicesListScreenModel', () => {
  it('resolves active company display by current language', () => {
    const display = resolveInvoiceListCompanyDisplay({
      activeCompanyId: 'company-2',
      lang: 'ar',
      companies: [
        { id: 'company-1', nameAr: 'شركة أولى', nameEn: 'First', logoUrl: 'first.png' },
        { id: 'company-2', nameAr: 'شركة ثانية', nameEn: 'Second', logoUrl: 'second.png' },
      ],
    });

    expect(display).toEqual({ companyName: 'شركة ثانية', logoUrl: 'second.png' });
  });

  it('keeps only supplier category types used by invoice filters', () => {
    expect(
      filterInvoiceSupplierCategories([
        { id: 'purchase', type: 'purchase' },
        { id: 'expense', type: 'Expense' },
        { id: 'sale', type: 'sale' },
        { id: 'empty' },
      ]),
    ).toEqual([
      { id: 'purchase', type: 'purchase' },
      { id: 'expense', type: 'Expense' },
    ]);
  });

  it('maps API invoice rows into table-ready rows without losing raw fields', () => {
    const rows = mapInvoicesToListTableRows({
      lang: 'en',
      t,
      invoices: [
        {
          id: 'invoice-1',
          kind: 'purchase',
          supplier: { nameAr: 'مورد', nameEn: 'Supplier' },
          createdByUser: { nameAr: 'أحمد', email: 'ahmed@example.com' },
          notes: 'Paid by bank',
          totalAmount: 200,
        },
        {
          id: 'invoice-2',
          kind: 'sale',
          createdByUser: { email: 'sales@example.com' },
        },
      ],
    });

    expect(rows[0]).toMatchObject({
      id: 'invoice-1',
      supplierName: 'Supplier',
      createdByDisplayName: 'أحمد',
      notesOrEmployee: 'Paid by bank',
      totalAmount: 200,
    });
    expect(rows[1]).toMatchObject({
      id: 'invoice-2',
      supplierName: 'Sales',
      createdByDisplayName: 'sales@example.com',
      notesOrEmployee: '',
    });
  });

  it('centralizes display fallbacks for creator, vault labels, import toast, and errors', () => {
    expect(getInvoiceListCreatedByDisplayName({ nameEn: 'Sara', email: 'sara@example.com' }, 'ar')).toBe('Sara');
    expect(
      resolveInvoiceListVaultRowLabel({
        lang: 'ar',
        unassignedLabel: 'غير محدد',
        row: { vaultId: null, unassigned: true },
      }),
    ).toBe('غير محدد');
    expect(buildInvoiceImportSuccessMessage(3)).toBe('تم استيراد 3 فاتورة بنجاح');
    expect(getInvoiceListErrorMessage(new Error('Denied'), 'Fallback')).toBe('Denied');
    expect(getInvoiceListErrorMessage('Denied', 'Fallback')).toBe('Fallback');
  });

  it('normalizes creator filter options from raw API data', () => {
    expect(
      normalizeInvoiceCreatorFilterOptions({
        users: [
          { id: 'user-1', nameAr: 'سارة' },
          null,
          'invalid',
          { id: 'user-2', email: 'user2@example.com' },
        ],
      }),
    ).toEqual({
      users: [
        { id: 'user-1', nameAr: 'سارة' },
        { id: 'user-2', email: 'user2@example.com' },
      ],
    });
  });

  it('converts table rows to view sources only when the invoice id exists', () => {
    expect(toInvoiceListViewSource({ id: 'invoice-1', invoiceNumber: 'INV-1' })).toMatchObject({
      id: 'invoice-1',
      invoiceNumber: 'INV-1',
    });
    expect(toInvoiceListViewSource({ invoiceNumber: 'INV-2' })).toBeNull();
    expect(toInvoiceListViewSource(null)).toBeNull();
  });
});
