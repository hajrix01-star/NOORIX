import { useTranslation } from '../../../i18n/useTranslation';
import { PrintPreviewModal } from '../../../ui';
import { useApp } from '../../../context/AppContext';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt, sumAmounts } from '../../../utils/format';
import { buildPrintDocumentHtml } from '../../../utils/printUtils';
import { buildPrintTableHtml } from '../../../utils/printTableHtml';
import { purchaseBatchDisplayName } from '../batch/purchaseBatchDisplayModel';
import { toPurchaseBatchFiniteNumber } from '../batch/purchaseBatchNumberModel';
import type { PurchaseBatchInvoice, PurchaseBatchSummaryRow } from '../batch/purchaseBatchTypes';

export type BatchPrintSheetProps = {
  batch: PurchaseBatchSummaryRow;
  onClose: () => void;
};

function invoiceKindLabel(invoice: PurchaseBatchInvoice, t: (key: string, ...args: unknown[]) => string) {
  return invoice.kind === 'purchase' ? t('purchaseType') : t('expenseType');
}

export function buildPurchaseBatchPrintHtml(input: {
  batch: PurchaseBatchSummaryRow;
  companyName: string;
  logoUrl?: string;
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
}) {
  const { batch, companyName, logoUrl = '', lang, t } = input;
  const invoices = batch.invoices;
  const activeInvoices = invoices.filter((invoice) => invoice.status !== 'cancelled');
  const net = sumAmounts(activeInvoices, 'netAmount');
  const tax = sumAmounts(activeInvoices, 'taxAmount');
  const total = sumAmounts(activeInvoices, 'totalAmount');
  const dateStr = invoices[0]?.transactionDate ? formatSaudiDate(invoices[0].transactionDate) : '-';

  return buildPrintDocumentHtml({
    title: t('batchLabel', batch.batchId),
    companyName,
    logoUrl,
    subtitle: t('batchPrintSubtitle', dateStr, activeInvoices.length),
    landscape: true,
    showPageCounter: true,
    htmlDir: lang === 'ar' ? 'rtl' : 'ltr',
    htmlLang: lang === 'ar' ? 'ar' : 'en',
    body: buildPrintTableHtml({
      columns: [
        { key: 'index', header: '#' },
        { key: 'invoiceNumber', header: t('documentNumber') },
        { key: 'supplierInvoiceNumber', header: t('supplierInvoiceNumber') },
        { key: 'supplier', header: t('supplier') },
        { key: 'kind', header: t('kind') },
        { key: 'net', header: t('net') },
        { key: 'tax', header: t('tax') },
        { key: 'total', header: t('total') },
        { key: 'date', header: t('date') },
      ],
      rows: activeInvoices.map((invoice, index) => ({
        index: index + 1,
        invoiceNumber: invoice.invoiceNumber ?? '-',
        supplierInvoiceNumber: invoice.supplierInvoiceNumber ?? '-',
        supplier: purchaseBatchDisplayName(invoice.supplier, lang),
        kind: invoiceKindLabel(invoice, t),
        net: `${fmt(toPurchaseBatchFiniteNumber(invoice.netAmount), 2)} SR`,
        tax: `${fmt(toPurchaseBatchFiniteNumber(invoice.taxAmount), 2)} SR`,
        total: `${fmt(toPurchaseBatchFiniteNumber(invoice.totalAmount), 2)} SR`,
        date: formatSaudiDate(invoice.transactionDate),
      })),
      footerRows: [[
        { value: t('totalSum', activeInvoices.length), colSpan: 5 },
        { value: `${fmt(net, 2)} SR` },
        { value: `${fmt(tax, 2)} SR` },
        { value: `${fmt(total, 2)} SR` },
        { value: '' },
      ]],
    }),
  });
}

export function BatchPrintSheet({ batch, onClose }: BatchPrintSheetProps) {
  const { t, lang } = useTranslation();
  const { companies, activeCompanyId } = useApp();
  const company = companies?.find((item) => item.id === activeCompanyId);
  const companyName = lang === 'en'
    ? (company?.nameEn || company?.nameAr || '')
    : (company?.nameAr || company?.nameEn || '');
  const html = buildPurchaseBatchPrintHtml({
    batch,
    companyName,
    logoUrl: String(company?.logoUrl || '').trim(),
    lang,
    t,
  });

  return (
    <PrintPreviewModal
      open
      onClose={onClose}
      title={t('batchLabel', batch.batchId)}
      html={html}
      closeLabel={t('close') || 'Close'}
      printLabel={`${t('print')} / PDF`}
    />
  );
}
