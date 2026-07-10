import { describe, expect, it } from 'vitest';
import { buildInvoiceExportColumnDefs, invoiceToExportRow } from './invoicesListExportModel';
import type { InvoiceListRawInvoice } from './invoicesListScreenModel';

const t = (key: string, ...args: unknown[]) => {
  if (key === 'invoicesExportVaultSlotName') return `vaultName${args[0]}`;
  if (key === 'invoicesExportVaultSlotType') return `vaultType${args[0]}`;
  if (key === 'invoicesExportVaultSlotAmount') return `vaultAmt${args[0]}`;
  if (key === 'vaultTypeCash') return 'Cash';
  return key;
};

const kindMap = { purchase: { label: 'Purchase' } };
const statusMap = { posted: { label: 'Posted' } };

describe('invoicesListExportModel', () => {
  it('builds export columns with all vault slots', () => {
    const columns = buildInvoiceExportColumnDefs(t);
    expect(columns.some((column) => column.key === 'vault1Name')).toBe(true);
    expect(columns.some((column) => column.key === 'vault5Amount')).toBe(true);
    expect(columns.find((column) => column.key === 'invoiceNumber')?.label).toBe('documentNumber');
  });

  it('maps invoice rows to export rows with shared list naming rules', () => {
    const invoice: InvoiceListRawInvoice = {
      kind: 'purchase',
      status: 'posted',
      invoiceNumber: '1',
      supplierInvoiceNumber: 'S1',
      supplier: { nameAr: 'Supplier AR', nameEn: 'Supplier EN' },
      createdByUser: { nameEn: 'Creator EN', email: 'creator@example.com' },
      netAmount: 10,
      taxAmount: 1.5,
      totalAmount: 11.5,
      transactionDate: '2024-01-15',
      notes: 'note',
      vaultAllocations: [
        { id: 'a1', amount: 11.5, vault: { nameAr: 'Vault AR', nameEn: 'Vault EN', type: 'cash' } },
      ],
    };

    const row = invoiceToExportRow(invoice, { t, lang: 'en', kindMap, statusMap });
    expect(row.kind).toBe('Purchase');
    expect(row.status).toBe('Posted');
    expect(row.supplierName).toBe('Supplier EN');
    expect(row.createdByUserName).toBe('Creator EN');
    expect(row.vault1Name).toBe('Vault EN');
    expect(row.vault1Type).toBe('Cash');
    expect(row.netAmount).toBe(10);
  });
});
