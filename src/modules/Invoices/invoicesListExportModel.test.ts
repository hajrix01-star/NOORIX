import { describe, it, expect } from 'vitest';
import { buildInvoiceExportColumnDefs, invoiceToExportRow } from './invoicesListExportModel';

const t = (k: any, ...args: any[]) => {
  if (k === 'invoicesExportVaultSlotName') return `vaultName${args[0]}`;
  if (k === 'invoicesExportVaultSlotType') return `vaultType${args[0]}`;
  if (k === 'invoicesExportVaultSlotAmount') return `vaultAmt${args[0]}`;
  return k;
};

const kindMap = { purchase: { label: 'شراء' } };
const statusMap = { posted: { label: 'مرحّل' } };

describe('invoicesListExportModel', () => {
  it('buildInvoiceExportColumnDefs includes vault slot keys', () => {
    const cols = buildInvoiceExportColumnDefs(t);
    expect(cols.some((c: any) => c.key === 'vault1Name')).toBe(true);
    expect(cols.some((c: any) => c.key === 'vault5Amount')).toBe(true);
    expect(cols.find((c: any) => c.key === 'invoiceNumber')?.label).toBe('documentNumber');
  });

  it('invoiceToExportRow maps amounts and vault slots', () => {
    const inv = {
      kind: 'purchase',
      status: 'posted',
      invoiceNumber: '1',
      supplierInvoiceNumber: 'S1',
      supplier: { nameAr: 'مورد', nameEn: 'Sup' },
      netAmount: 10,
      taxAmount: 1.5,
      totalAmount: 11.5,
      transactionDate: '2024-01-15',
      notes: 'n',
      vaultAllocations: [
        { id: 'a1', amount: 11.5, vault: { nameAr: 'خزنة', type: 'cash' } },
      ],
    };
    const row = invoiceToExportRow(inv as any, { t, lang: 'ar', kindMap, statusMap }) as Record<string, unknown>;
    expect(row.kind).toBe('شراء');
    expect(row.status).toBe('مرحّل');
    expect((row as { vault1Name?: string }).vault1Name).toBeTruthy();
    expect(row.netAmount).toBe(10);
  });
});
