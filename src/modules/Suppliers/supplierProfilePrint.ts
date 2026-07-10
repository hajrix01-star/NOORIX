import { fmt } from '../../utils/format';
import { formatSaudiDateISO, getSaudiToday } from '../../utils/saudiDate';
import { buildPrintDefinitionTableHtml, buildPrintRecordsTableHtml } from '../../utils/printTableHtml';
import type {
  SupplierCategoryRecord,
  SupplierInvoiceRecord,
  SupplierLang,
  SupplierRecord,
  TranslationFn,
} from './supplierTypes';
import { getSupplierCategoryName, getSupplierName } from './supplierDisplayModel';

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function amount(value: SupplierInvoiceRecord[keyof SupplierInvoiceRecord]) {
  return Number(value || 0);
}

export function buildSupplierInvoicesPrintHtml(invoices: SupplierInvoiceRecord[], t: TranslationFn) {
  const netKey = t('net');
  const taxKey = t('tax');
  const totalKey = t('total');
  return buildPrintRecordsTableHtml({
    records: invoices.map((invoice) => ({
      [t('supplierInvoiceNumber')]: invoice.supplierInvoiceNumber || invoice.invoiceNumber || '-',
      [t('documentNumber')]: invoice.invoiceNumber || '-',
      [t('type')]: invoice.kind || '-',
      [t('date')]: invoice.transactionDate ? formatSaudiDateISO(invoice.transactionDate) : '-',
      [netKey]: `${fmt(amount(invoice.netAmount))} SR`,
      [taxKey]: `${fmt(amount(invoice.taxAmount))} SR`,
      [totalKey]: `${fmt(amount(invoice.totalAmount))} SR`,
    })),
    emptyMessage: t('noInvoicesInPeriod'),
    numericKeys: [netKey, taxKey, totalKey],
  });
}

export function buildSupplierProfilePrintHtml(args: {
  supplier: SupplierRecord;
  category?: SupplierCategoryRecord;
  invoices: SupplierInvoiceRecord[];
  summary: {
    count: number;
    net: string | number;
    tax: string | number;
    total: string | number;
  };
  lang: SupplierLang;
  t: TranslationFn;
}) {
  const { supplier, category, invoices, summary, lang, t } = args;
  const supplierLabel = getSupplierName(supplier, lang);

  return `
    <section>
      <h2>${escapeHtml(t('supplierProfile'))}</h2>
      ${buildPrintDefinitionTableHtml({
        entries: [
          { label: t('name'), value: supplierLabel },
          { label: t('category'), value: getSupplierCategoryName(category, lang) },
          { label: t('taxNumber'), value: supplier.taxNumber || '-' },
          { label: t('phone'), value: supplier.phone || '-' },
          { label: t('taxRegisteredCol'), value: supplier.isTaxRegistered ? t('taxRegisteredBadgeYes') : t('taxRegisteredBadgeNo') },
        ],
        tableClassName: 'supplier-profile-print-table',
        wrapperClassName: 'supplier-profile-print-table-wrap',
      })}
      <h2>${escapeHtml(t('supplierProfileSummary'))}</h2>
      ${buildPrintDefinitionTableHtml({
        entries: [
          { label: t('supplierProfileInvoiceCount'), value: String(summary.count) },
          { label: t('net'), value: `${fmt(Number(summary.net || 0))} SR` },
          { label: t('tax'), value: `${fmt(Number(summary.tax || 0))} SR` },
          { label: t('total'), value: `${fmt(Number(summary.total || 0))} SR` },
        ],
        tableClassName: 'supplier-profile-print-table',
        wrapperClassName: 'supplier-profile-print-table-wrap',
      })}
      <h2>${escapeHtml(t('supplierProfileInvoicesTab'))}</h2>
      ${buildSupplierInvoicesPrintHtml(invoices, t)}
    </section>`;
}

export function buildSupplierProfilePrintSubtitle(t: TranslationFn) {
  return `${t('supplierProfile')} - ${getSaudiToday()}`;
}
