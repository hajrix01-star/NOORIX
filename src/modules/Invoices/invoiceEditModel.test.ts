import { describe, expect, it } from 'vitest';
import {
  EMPTY_INVOICE_EDIT_FORM,
  buildInvoiceEditInitialForm,
  buildInvoiceEditUpdateBody,
  getInvoiceEditSupplierPolicy,
  hasPositiveInvoiceEditTotal,
  updateInvoiceEditFormField,
  validateInvoiceEditForm,
} from './invoiceEditModel';

describe('invoiceEditModel', () => {
  it('resolves supplier policy by invoice kind', () => {
    expect(getInvoiceEditSupplierPolicy('purchase')).toEqual({ hasSupplier: true, supplierRequired: true });
    expect(getInvoiceEditSupplierPolicy('fixed_expense')).toEqual({ hasSupplier: true, supplierRequired: false });
    expect(getInvoiceEditSupplierPolicy('salary')).toEqual({ hasSupplier: false, supplierRequired: false });
  });

  it('builds initial form with tax split and first vault allocation', () => {
    expect(
      buildInvoiceEditInitialForm(
        {
          supplierId: 'supplier-1',
          categoryId: 'category-maintenance',
          supplierInvoiceNumber: '',
          invoiceNumber: 'INV-1',
          kind: 'expense',
          totalAmount: 115,
          isTaxable: true,
          transactionDate: '2026-01-03T10:00:00.000Z',
          notes: 'note',
          vaultAllocations: [{ vaultId: 'vault-1' }],
        },
        0.15,
      ),
    ).toMatchObject({
      supplierId: 'supplier-1',
      categoryId: 'category-maintenance',
      supplierInvoiceNumber: 'INV-1',
      kind: 'expense',
      totalAmount: '115',
      netAmount: '100.00',
      taxAmount: '15.00',
      transactionDate: '2026-01-03',
      notes: 'note',
      vaultId: 'vault-1',
    });
  });

  it('recalculates tax display fields when total or taxable flag changes', () => {
    const form = updateInvoiceEditFormField(
      { ...EMPTY_INVOICE_EDIT_FORM, totalAmount: '115' },
      'totalAmount',
      '115',
      0.15,
    );
    expect(form.netAmount).toBe('100.00');
    expect(form.taxAmount).toBe('15.00');

    const notTaxable = updateInvoiceEditFormField(form, 'isTaxable', false, 0.15);
    expect(notTaxable.netAmount).toBe('115.00');
    expect(notTaxable.taxAmount).toBe('0.00');
  });

  it('validates and builds update payload centrally', () => {
    const form = {
      ...EMPTY_INVOICE_EDIT_FORM,
      supplierInvoiceNumber: '  INV-2 ',
      categoryId: 'category-maintenance',
      kind: 'purchase',
      totalAmount: '200',
      transactionDate: '2026-02-01',
      notes: ' note ',
      vaultId: 'vault-2',
    };

    expect(
      validateInvoiceEditForm({
        form,
        supplierRequired: true,
        hasVaults: true,
        messages: {
          invoiceNumberRequired: 'invoice required',
          totalMustBePositiveShort: 'positive total',
          selectVault: 'select vault',
        },
      }),
    ).toBe('');

    expect(
      buildInvoiceEditUpdateBody({
        form,
        hasSupplier: true,
        supplierRequired: true,
        isMultiVault: false,
        initialVaultKey: 'vault-1',
      }),
    ).toMatchObject({
      totalAmount: 200,
      supplierInvoiceNumber: 'INV-2',
      categoryId: 'category-maintenance',
      isTaxable: true,
      kind: 'purchase',
      notes: 'note',
      vaultId: 'vault-2',
    });
    expect(hasPositiveInvoiceEditTotal('200')).toBe(true);
  });
});
