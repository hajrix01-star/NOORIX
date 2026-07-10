import { formatSaudiDateISO } from '../../utils/saudiDate';
import {
  MAX_VAULT_SLOTS,
  getAllocationsForExport,
  type InvoiceExportTranslate,
  type InvoiceExportVaultSource,
} from './invoicesListScreenHelpers';
import {
  getInvoiceListCreatedByDisplayName,
  getInvoiceListSupplierName,
  type InvoiceListRawInvoice,
} from './invoicesListScreenModel';
import { toInvoiceFiniteNumber } from './invoiceNumberModel';
import type { InvoiceTableLang } from './invoiceTableRowModel';

export type InvoiceExportColumnDef = {
  key: string;
  label: string;
};

export type InvoiceExportBadgeMap = Record<string, { label?: unknown } | undefined>;

export type InvoiceExportRow = Record<string, string | number>;

export type InvoiceExportContext = {
  t: InvoiceExportTranslate;
  lang: InvoiceTableLang;
  kindMap: InvoiceExportBadgeMap;
  statusMap: InvoiceExportBadgeMap;
};

export function buildInvoiceExportColumnDefs(t: InvoiceExportTranslate): InvoiceExportColumnDef[] {
  const vaultCols: InvoiceExportColumnDef[] = [];
  for (let slot = 1; slot <= MAX_VAULT_SLOTS; slot += 1) {
    vaultCols.push(
      { key: `vault${slot}Name`, label: t('invoicesExportVaultSlotName', slot) },
      { key: `vault${slot}Type`, label: t('invoicesExportVaultSlotType', slot) },
      { key: `vault${slot}Amount`, label: t('invoicesExportVaultSlotAmount', slot) },
    );
  }

  return [
    { key: 'invoiceNumber', label: t('documentNumber') },
    { key: 'supplierInvoiceNumber', label: t('supplierInvoiceNumber') },
    { key: 'supplierName', label: t('supplier') },
    { key: 'createdByUserName', label: t('invoiceUserColumn') },
    { key: 'notes', label: t('invoiceNotesColumn') || 'Notes' },
    { key: 'kind', label: t('type') },
    ...vaultCols,
    { key: 'netAmount', label: t('net') },
    { key: 'taxAmount', label: t('tax') },
    { key: 'totalAmount', label: t('total') },
    { key: 'transactionDate', label: t('date') },
    { key: 'status', label: t('statusLabel') },
  ];
}

export function invoiceToExportRow(invoice: InvoiceListRawInvoice, context: InvoiceExportContext) {
  const { t, lang, kindMap, statusMap } = context;
  const kindLabel = getExportBadgeLabel(kindMap, invoice.kind);
  const statusLabel = getExportBadgeLabel(statusMap, invoice.status);
  const allocations = getAllocationsForExport(invoice, lang, t);
  const row: InvoiceExportRow = {
    invoiceNumber: scalarExportValue(invoice.invoiceNumber),
    supplierInvoiceNumber: scalarExportValue(invoice.supplierInvoiceNumber),
    supplierName: getInvoiceListSupplierName({ invoice, lang, t }) || '\u2014',
    createdByUserName: getInvoiceListCreatedByDisplayName(invoice.createdByUser, lang) || '\u2014',
    notes: invoice.notes ?? '',
    kind: kindLabel || invoice.kind || '\u2014',
    netAmount: toInvoiceFiniteNumber(invoice.netAmount),
    taxAmount: toInvoiceFiniteNumber(invoice.taxAmount),
    totalAmount: toInvoiceFiniteNumber(invoice.totalAmount),
    transactionDate: invoice.transactionDate ? formatSaudiDateISO(invoice.transactionDate) : '\u2014',
    status: statusLabel || invoice.status || '\u2014',
  };

  for (let index = 0; index < MAX_VAULT_SLOTS; index += 1) {
    const slot = index + 1;
    const allocation = allocations[index];
    row[`vault${slot}Name`] = allocation?.name ?? '';
    row[`vault${slot}Type`] = allocation?.type ?? '';
    row[`vault${slot}Amount`] = allocation ? allocation.amount : '';
  }
  return row;
}

function getExportBadgeLabel(map: InvoiceExportBadgeMap, key: unknown) {
  if (!key) return '';
  const label = map[String(key)]?.label;
  return label == null || label === '' ? '' : String(label);
}

function scalarExportValue(value: unknown) {
  return value == null ? '' : String(value);
}
