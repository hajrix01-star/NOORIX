import { describe, expect, it } from 'vitest';
import {
  buildInvoiceViewFields,
  getInvoiceViewDocumentNumber,
  getInvoiceViewVaultSplits,
  getInvoiceViewVaultSummary,
  hasInvoiceViewMultipleVaultSplits,
  pickInvoiceViewName,
} from './invoiceViewModel';

const labels = {
  invoiceNumber: 'Invoice number',
  date: 'Date',
  type: 'Type',
  status: 'Status',
  supplier: 'Supplier',
  invoiceVaultColumn: 'Vault',
  net: 'Net',
  tax: 'Tax',
  total: 'Total',
  invoiceVaultMultiple: 'Multiple vaults',
};

const fmt = (value: number) => value.toFixed(2);

describe('invoiceViewModel', () => {
  it('resolves names and document numbers deterministically', () => {
    expect(pickInvoiceViewName('en', { nameAr: 'Arabic', nameEn: 'English' })).toBe('English');
    expect(pickInvoiceViewName('ar', { nameAr: 'Arabic', nameEn: 'English' })).toBe('Arabic');
    expect(pickInvoiceViewName('en', { name: 'Fallback', nameAr: '  ', nameEn: '' })).toBe('Fallback');
    expect(getInvoiceViewDocumentNumber({ id: 'i1', supplierInvoiceNumber: 'S-1', invoiceNumber: 'I-1' })).toBe(
      'S-1',
    );
  });

  it('builds field rows with formatted money values', () => {
    const fields = buildInvoiceViewFields({
      invoice: {
        id: 'i1',
        invoiceNumber: 'INV-1',
        kind: 'purchase',
        status: 'active',
        supplier: { nameEn: 'Supplier' },
        vault: { nameEn: 'Cash' },
        netAmount: 100,
        taxAmount: 15,
        totalAmount: 115,
      },
      labels,
      lang: 'en',
      fmt,
    });

    expect(fields.map((field) => field.value)).toContain('Supplier');
    expect(fields.find((field) => field.label === 'Total')).toMatchObject({
      value: '115.00 SR',
      tone: 'blue',
      bold: true,
    });
  });

  it('summarizes and maps multi-vault splits', () => {
    const invoice = {
      id: 'i1',
      vaultAllocations: [
        { id: 'a1', amount: 40, vault: { nameEn: 'Cash' } },
        { id: 'a2', amount: 60, vault: { nameEn: 'Bank' } },
      ],
    };

    expect(hasInvoiceViewMultipleVaultSplits(invoice)).toBe(true);
    expect(getInvoiceViewVaultSummary({ invoice, lang: 'en', multipleLabel: 'Multiple vaults' })).toBe(
      'Multiple vaults',
    );
    expect(getInvoiceViewVaultSplits(invoice, 'en')).toEqual([
      { key: 'a1', vaultName: 'Cash', amount: 40 },
      { key: 'a2', vaultName: 'Bank', amount: 60 },
    ]);
  });
});
