import {
  pickInvoiceTableName,
  type InvoiceTableLang,
  type InvoiceTableNamedEntity,
} from './invoiceTableRowModel';
import { toInvoiceFiniteNumber } from './invoiceNumberModel';

export const PAGE_SIZE = 50;
export const MAX_VAULT_SLOTS = 5;

export type InvoiceExportTranslate = (key: string, ...args: unknown[]) => string;

export type InvoiceExportVault = InvoiceTableNamedEntity & {
  type?: string | null;
};

export type InvoiceExportVaultAllocation = {
  id?: string | null;
  amount?: number | string | null;
  vault?: InvoiceExportVault | null;
};

export type InvoiceExportVaultSource = {
  totalAmount?: number | string | null;
  vault?: InvoiceExportVault | null;
  vaultAllocations?: InvoiceExportVaultAllocation[] | null;
};

export type InvoiceExportVaultRow = {
  name: string;
  type: string;
  amount: number;
};

export function vaultTypeLabelForExport(type: unknown, t: InvoiceExportTranslate) {
  const map: Record<string, string> = {
    cash: 'vaultTypeCash',
    bank: 'vaultTypeBank',
    app: 'vaultTypeApp',
  };
  const key = map[String(type)];
  return key ? t(key) : type ? String(type) : '\u2014';
}

export function getAllocationsForExport(
  invoice: InvoiceExportVaultSource,
  lang: InvoiceTableLang,
  t: InvoiceExportTranslate,
) {
  const rows: InvoiceExportVaultRow[] = [];
  const allocations = invoice.vaultAllocations;
  if (Array.isArray(allocations) && allocations.length > 0) {
    for (const allocation of allocations) {
      rows.push({
        name: pickInvoiceTableName(lang, allocation.vault),
        type: vaultTypeLabelForExport(allocation.vault?.type, t),
        amount: toInvoiceFiniteNumber(allocation.amount),
      });
    }
    return rows;
  }

  if (invoice.vault) {
    rows.push({
      name: pickInvoiceTableName(lang, invoice.vault),
      type: vaultTypeLabelForExport(invoice.vault.type, t),
      amount: toInvoiceFiniteNumber(invoice.totalAmount),
    });
  }
  return rows;
}
