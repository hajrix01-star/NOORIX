import { describe, expect, it } from 'vitest';
import {
  asInvoiceTableText,
  compactInvoiceDocumentNumber,
  getInvoiceTableAmountToneClass,
  getInvoiceTableVaultName,
  mapInvoiceTableVaultChips,
  pickInvoiceTableName,
} from './invoiceTableRowModel';

const fmt = (value: number) => value.toFixed(2);

describe('invoiceTableRowModel', () => {
  it('normalizes text and bilingual names', () => {
    expect(asInvoiceTableText('INV-1')).toBe('INV-1');
    expect(asInvoiceTableText('')).toBe('\u2014');
    expect(pickInvoiceTableName('en', { nameAr: 'Arabic', nameEn: 'English' })).toBe('English');
    expect(pickInvoiceTableName('ar', { nameAr: 'Arabic', nameEn: 'English' })).toBe('Arabic');
    expect(pickInvoiceTableName('en', { name: 'Fallback', nameAr: ' ', nameEn: '' })).toBe('Fallback');
  });

  it('maps vault chips with formatted titles', () => {
    expect(
      mapInvoiceTableVaultChips({
        row: {
          vaultAllocations: [{ id: 'a1', amount: '15', vault: { nameEn: 'Cash' } }],
        },
        lang: 'en',
        fmt,
      }),
    ).toEqual([{ key: 'a1', label: 'Cash', amount: 15, title: 'Cash \u2014 15.00' }]);
  });

  it('resolves fallback vault and amount tone', () => {
    expect(getInvoiceTableVaultName({ vault: { nameEn: 'Bank' } }, 'en')).toBe('Bank');
    expect(getInvoiceTableAmountToneClass({ kind: 'sale' })).toBe('text-[var(--color-nx-sales)]');
    expect(getInvoiceTableAmountToneClass({ kind: 'expense' })).toBe('text-[var(--color-nx-expenses)]');
  });

  it('compacts long document numbers for table display only', () => {
    expect(compactInvoiceDocumentNumber('PUR-20260708-001')).toBe('PUR-001');
    expect(compactInvoiceDocumentNumber('EXP-20260708-004')).toBe('EXP-004');
    expect(compactInvoiceDocumentNumber('SHORT-1')).toBe('SHORT-1');
    expect(compactInvoiceDocumentNumber('VERY-LONG-DOCUMENT-NUMBER')).toBe('VERY-L...MBER');
  });
});
