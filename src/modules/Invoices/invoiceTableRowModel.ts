import { formatSaudiDateISO } from '../../utils/saudiDate';

const EMPTY_INVOICE_TABLE_VALUE = '\u2014';

export type InvoiceTableLang = 'ar' | 'en' | string;

export type InvoiceTableNamedEntity = {
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

export type InvoiceTableVaultAllocation = {
  id?: string | null;
  amount?: number | string | null;
  vault?: InvoiceTableNamedEntity | null;
};

export type InvoiceTableRow = {
  id?: string | null;
  invoiceNumber?: string | number | null;
  supplierInvoiceNumber?: string | number | null;
  supplierName?: string | null;
  createdByDisplayName?: string | null;
  notes?: string | null;
  kind?: string | null;
  status?: string | null;
  vault?: InvoiceTableNamedEntity | null;
  vaultAllocations?: InvoiceTableVaultAllocation[] | null;
  netAmount?: number | string | null;
  taxAmount?: number | string | null;
  totalAmount?: number | string | null;
  transactionDate?: string | Date | null;
};

export type InvoiceTableVaultChip = {
  key: string;
  label: string;
  amount: number;
  title: string;
};

export function getInvoiceTableEmptyValue() {
  return EMPTY_INVOICE_TABLE_VALUE;
}

export function asInvoiceTableText(value: unknown) {
  if (value == null || value === '') return EMPTY_INVOICE_TABLE_VALUE;
  return String(value);
}

export function asInvoiceTableNumber(value: unknown) {
  return Number(value ?? 0);
}

export function pickInvoiceTableName(
  lang: InvoiceTableLang,
  entity?: InvoiceTableNamedEntity | null,
  fallback = EMPTY_INVOICE_TABLE_VALUE,
) {
  if (!entity) return fallback;
  const ar = entity.nameAr || entity.name || '';
  const en = entity.nameEn || entity.name || '';
  const selected = lang === 'en' ? en || ar : ar || en;
  return selected || fallback;
}

export function formatInvoiceTableDate(value?: string | Date | null) {
  return value ? formatSaudiDateISO(value) : EMPTY_INVOICE_TABLE_VALUE;
}

export function getInvoiceTableAmountToneClass(row: InvoiceTableRow) {
  return row.kind === 'sale' ? 'text-[var(--color-nx-sales)]' : 'text-[var(--color-nx-expenses)]';
}

export function getInvoiceTableDocumentToneClass(row: InvoiceTableRow) {
  return row.kind === 'sale' ? 'text-nx-sales' : 'text-nx-expenses';
}

export function mapInvoiceTableVaultChips(input: {
  row: InvoiceTableRow;
  lang: InvoiceTableLang;
  fmt: (value: number) => string;
}) {
  return (input.row.vaultAllocations ?? []).map<InvoiceTableVaultChip>((allocation, index) => {
    const label = pickInvoiceTableName(input.lang, allocation.vault);
    const amount = asInvoiceTableNumber(allocation.amount);
    return {
      key: allocation.id || `vault-allocation-${index}`,
      label,
      amount,
      title: label !== EMPTY_INVOICE_TABLE_VALUE ? `${label} \u2014 ${input.fmt(amount)} SR` : '',
    };
  });
}

export function getInvoiceTableVaultName(row: InvoiceTableRow, lang: InvoiceTableLang) {
  return pickInvoiceTableName(lang, row.vault);
}

export function hasInvoiceTableVaultChips(row: InvoiceTableRow) {
  return (row.vaultAllocations?.length ?? 0) > 0;
}
