import { describe, expect, it } from 'vitest';
import {
  MAX_VAULT_SLOTS,
  PAGE_SIZE,
  getAllocationsForExport,
  vaultTypeLabelForExport,
  type InvoiceExportVaultSource,
} from './invoicesListScreenHelpers';

const labels: Record<string, string> = {
  vaultTypeCash: 'Cash',
  vaultTypeBank: 'Bank',
  vaultTypeApp: 'App',
};
const t = (key: string) => labels[key] || key;

describe('invoicesListScreenHelpers', () => {
  it('exports pagination and export slot constants', () => {
    expect(PAGE_SIZE).toBe(50);
    expect(MAX_VAULT_SLOTS).toBe(5);
  });

  it('maps known vault types and preserves unknown labels', () => {
    expect(vaultTypeLabelForExport('cash', t)).toBe('Cash');
    expect(vaultTypeLabelForExport('bank', t)).toBe('Bank');
    expect(vaultTypeLabelForExport('unknown', t)).toBe('unknown');
    expect(vaultTypeLabelForExport('', t)).toBe('\u2014');
  });

  it('uses vault allocations when present', () => {
    const invoice: InvoiceExportVaultSource = {
      totalAmount: 100,
      vaultAllocations: [
        { id: 'a1', amount: 40, vault: { nameAr: 'Vault 1 AR', nameEn: 'Vault 1 EN', type: 'cash' } },
        { id: 'a2', amount: 60, vault: { nameAr: 'Vault 2 AR', type: 'bank' } },
      ],
    };

    const rows = getAllocationsForExport(invoice, 'en', t);
    expect(rows).toEqual([
      { name: 'Vault 1 EN', type: 'Cash', amount: 40 },
      { name: 'Vault 2 AR', type: 'Bank', amount: 60 },
    ]);
  });

  it('falls back to the single invoice vault', () => {
    const invoice: InvoiceExportVaultSource = {
      totalAmount: 200,
      vault: { nameAr: 'Main AR', nameEn: 'Main EN', type: 'app' },
    };

    const rows = getAllocationsForExport(invoice, 'ar', t);
    expect(rows).toEqual([{ name: 'Main AR', type: 'App', amount: 200 }]);
  });
});
