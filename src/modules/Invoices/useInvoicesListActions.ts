import { useCallback } from 'react';
import { fetchAllInvoicesForExport } from '../../services/api';
import { exportToExcel } from '../../utils/exportUtils';
import { usePrintPreview } from '../../ui';
import { toYmd } from '../../utils/saudiDate';
import { buildPrintTableHtml } from '../../utils/printTableHtml';
import { MAX_VAULT_SLOTS } from './invoicesListScreenHelpers';
import {
  asInvoiceTableNumber,
  asInvoiceTableText,
  formatInvoiceTableDate,
  getInvoiceTableVaultName,
  type InvoiceTableRow,
} from './invoiceTableRowModel';
import {
  buildInvoiceListFetchParams,
  type InvoiceListFetchParams,
  type InvoiceListSortDir,
} from './invoicesListQueryModel';
import type { InvoiceExportColumnDef, InvoiceExportRow } from './invoicesListExportModel';
import {
  getInvoiceListErrorMessage,
  isInvoiceListRawInvoice,
  type InvoiceListRawInvoice,
} from './invoicesListScreenModel';
import { toInvoiceFiniteNumber } from './invoiceNumberModel';
import {
  getInvoiceViewVaultSplits,
  pickInvoiceViewName,
  type InvoiceViewSource,
} from './invoiceViewModel';

type Translate = (key: string, ...args: unknown[]) => string;
type ToastVariant = 'success' | 'error' | 'info' | 'warning' | string;
type UrlExtraFilters = { categoryId: string; expenseLineId: string };
type InvoiceListActionTotals = { count: number; net: unknown; tax: unknown; total: unknown };
type InvoicePrintSource = InvoiceTableRow | InvoiceViewSource;

type InvoiceListActionParams = {
  companyId: string;
  displayedTotal: number;
  invoiceQueryStartDate: string;
  invoiceQueryEndDate: string;
  dateFilterLabel: string;
  fromUrl: string;
  toUrl: string;
  kindForApi: string | undefined;
  sortKey: string;
  sortDir: InvoiceListSortDir;
  filterSupplierId: string;
  filterSupplierCategoryId: string;
  debouncedQ: string;
  urlExtra: UrlExtraFilters;
  showCancelled: boolean;
  filterHasNotesOnly: boolean;
  filterVaultId: string;
  invoiceBatchIdFromUrl: string;
  filterCreatedByUserId: string;
  mapInvoiceToExportRow: (invoice: InvoiceListRawInvoice) => InvoiceExportRow;
  exportColumnDefs: InvoiceExportColumnDef[];
  companyName: string;
  logoUrl: string;
  lang: string;
  t: Translate;
  fmt: (value: number) => string;
  showToast: (message: string, variant?: ToastVariant) => void;
  setExportBusy: (value: boolean) => void;
  serverAll: InvoiceListActionTotals;
};

export function buildInvoiceListActionFetchParams(params: InvoiceListActionParams): InvoiceListFetchParams {
  return buildInvoiceListFetchParams({
    companyId: params.companyId,
    startDate: params.invoiceQueryStartDate,
    endDate: params.invoiceQueryEndDate,
    kind: params.kindForApi,
    sortBy: params.sortKey,
    sortDir: params.sortDir,
    supplierId: params.filterSupplierId,
    supplierCategoryId: params.filterSupplierCategoryId,
    q: params.debouncedQ,
    categoryId: params.urlExtra.categoryId,
    expenseLineId: params.urlExtra.expenseLineId,
    includeCancelled: params.showCancelled,
    hasNotes: params.filterHasNotesOnly,
    vaultId: params.filterVaultId,
    batchId: params.invoiceBatchIdFromUrl,
    createdByUserId: params.filterCreatedByUserId,
  });
}

function mapRawInvoicesForExport(
  invoices: unknown[],
  mapInvoiceToExportRow: (invoice: InvoiceListRawInvoice) => InvoiceExportRow,
) {
  return invoices.filter(isInvoiceListRawInvoice).map(mapInvoiceToExportRow);
}

function invoicePrintRows(input: {
  invoice: InvoicePrintSource;
  lang: string;
  fmt: (value: number) => string;
  t: Translate;
}): Record<string, string>[] {
  const { invoice, lang, fmt, t } = input;
  const documentNumber = asInvoiceTableText(invoice.supplierInvoiceNumber || invoice.invoiceNumber);
  const vaultSplits = getInvoiceViewVaultSplits(invoice, lang);
  const vaultLabel = vaultSplits.length
    ? vaultSplits.map((split) => `${split.vaultName}: ${fmt(split.amount)} SR`).join(' | ')
    : 'supplierName' in invoice
      ? getInvoiceTableVaultName(invoice, lang)
      : pickInvoiceViewName(lang, invoice.vault);
  const supplierLabel = 'supplierName' in invoice
    ? asInvoiceTableText(invoice.supplierName)
    : pickInvoiceViewName(lang, invoice.supplier);

  const rows = [
    [t('invoiceNumber'), documentNumber],
    [t('date'), formatInvoiceTableDate(invoice.transactionDate)],
    [t('type'), asInvoiceTableText(invoice.kind)],
    [t('status'), asInvoiceTableText(invoice.status)],
    [t('supplier'), supplierLabel],
    [t('invoiceVaultColumn'), vaultLabel],
    [t('net'), `${fmt(asInvoiceTableNumber(invoice.netAmount))} SR`],
    [t('tax'), `${fmt(asInvoiceTableNumber(invoice.taxAmount))} SR`],
    [t('total'), `${fmt(asInvoiceTableNumber(invoice.totalAmount))} SR`],
  ];

  if (invoice.notes) rows.push([t('notes'), invoice.notes]);
  return rows.map(([label, value]) => ({ [t('reportItem')]: label, [t('value')]: value }));
}

export function useInvoicesListActions(params: InvoiceListActionParams) {
  const {
    companyId,
    displayedTotal,
    invoiceQueryStartDate,
    invoiceQueryEndDate,
    dateFilterLabel,
    fromUrl,
    toUrl,
    kindForApi,
    sortKey,
    sortDir,
    filterSupplierId,
    filterSupplierCategoryId,
    debouncedQ,
    urlExtra,
    showCancelled,
    filterHasNotesOnly,
    filterVaultId,
    invoiceBatchIdFromUrl,
    filterCreatedByUserId,
    mapInvoiceToExportRow,
    exportColumnDefs,
    companyName,
    logoUrl,
    lang,
    t,
    fmt,
    showToast,
    setExportBusy,
    serverAll,
  } = params;
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('invoicesTitle'),
    closeLabel: t('close') || 'Close',
    printLabel: `${t('print')} / PDF`,
  });

  const handleExportExcel = useCallback(async () => {
    if (!companyId || displayedTotal === 0) return;
    setExportBusy(true);
    try {
      const all = await fetchAllInvoicesForExport(buildInvoiceListActionFetchParams(params));
      const rows = mapRawInvoicesForExport(all, mapInvoiceToExportRow);
      const safeStart = toYmd(invoiceQueryStartDate).replace(/[^\d-]/g, '') || 'start';
      const safeEnd = toYmd(invoiceQueryEndDate).replace(/[^\d-]/g, '') || 'end';
      await exportToExcel({
        data: rows,
        filename: `invoices-${safeStart}_${safeEnd}.xlsx`,
        title: `${t('invoicesTitle')} — ${dateFilterLabel || ''}`,
        companyName,
        sheetName: lang === 'en' ? 'Invoices' : 'فواتير',
        columns: exportColumnDefs,
        rtl: true,
      });
      showToast(t('exportSuccess') || 'تم التصدير', 'success');
    } catch (error: unknown) {
      showToast(getInvoiceListErrorMessage(error, t('exportFailed')), 'error');
    } finally {
      setExportBusy(false);
    }
  }, [
    companyId,
    displayedTotal,
    invoiceQueryStartDate,
    invoiceQueryEndDate,
    dateFilterLabel,
    kindForApi,
    sortKey,
    sortDir,
    filterSupplierId,
    filterSupplierCategoryId,
    debouncedQ,
    urlExtra.categoryId,
    urlExtra.expenseLineId,
    showCancelled,
    mapInvoiceToExportRow,
    exportColumnDefs,
    companyName,
    t,
    lang,
    showToast,
    filterHasNotesOnly,
    filterVaultId,
    invoiceBatchIdFromUrl,
    filterCreatedByUserId,
    setExportBusy,
    openPrintDocumentPreview,
  ]);

  const handlePrintInvoices = useCallback(async () => {
    if (!companyId || displayedTotal === 0) return;
    setExportBusy(true);
    try {
      const all = await fetchAllInvoicesForExport(buildInvoiceListActionFetchParams(params));
      const rows = mapRawInvoicesForExport(all, mapInvoiceToExportRow);
      const baseMetaCols = 6;
      const vaultBlockCols = MAX_VAULT_SLOTS * 3;
      const table = buildPrintTableHtml({
        columns: exportColumnDefs.map((col) => ({ key: col.key, header: col.label })),
        rows,
        emptyMessage: t('noInvoicesInPeriod'),
        footerRows: [[
          { value: t('totalInvoices', serverAll.count), colSpan: baseMetaCols },
          { value: '', colSpan: vaultBlockCols },
          { value: `${fmt(toInvoiceFiniteNumber(serverAll.net))} SR` },
          { value: `${fmt(toInvoiceFiniteNumber(serverAll.tax))} SR` },
          { value: `${fmt(toInvoiceFiniteNumber(serverAll.total))} SR` },
          { value: '', colSpan: 2 },
        ]],
      });
      openPrintDocumentPreview({
        title: t('invoicesTitle'),
        companyName,
        subtitle: `${t('invoicesTitle')} — ${(fromUrl && toUrl ? `${fromUrl} — ${toUrl}` : dateFilterLabel) || ''}`,
        logoUrl,
        landscape: true,
        body: table,
      });
    } catch (error: unknown) {
      showToast(getInvoiceListErrorMessage(error, t('exportFailed')), 'error');
    } finally {
      setExportBusy(false);
    }
  }, [
    companyId,
    displayedTotal,
    invoiceQueryStartDate,
    invoiceQueryEndDate,
    fromUrl,
    toUrl,
    dateFilterLabel,
    kindForApi,
    sortKey,
    sortDir,
    filterSupplierId,
    filterSupplierCategoryId,
    debouncedQ,
    urlExtra.categoryId,
    urlExtra.expenseLineId,
    showCancelled,
    mapInvoiceToExportRow,
    exportColumnDefs,
    t,
    companyName,
    logoUrl,
    serverAll,
    fmt,
    showToast,
    filterHasNotesOnly,
    filterVaultId,
    invoiceBatchIdFromUrl,
    filterCreatedByUserId,
    setExportBusy,
    openPrintDocumentPreview,
  ]);

  const handlePrintSingleInvoice = useCallback((invoice: InvoicePrintSource) => {
    const documentNumber = asInvoiceTableText(invoice.supplierInvoiceNumber || invoice.invoiceNumber);
    openPrintDocumentPreview({
      title: `${t('invoicesTitle')} - ${documentNumber}`,
      companyName,
      logoUrl,
      subtitle: documentNumber,
      landscape: false,
      body: buildPrintTableHtml({
        columns: [
          { key: t('reportItem'), header: t('reportItem') },
          { key: t('value'), header: t('value') },
        ],
        rows: invoicePrintRows({ invoice, lang, fmt, t }),
      }),
    });
  }, [companyName, fmt, lang, logoUrl, openPrintDocumentPreview, t]);

  return { handleExportExcel, handlePrintInvoices, handlePrintSingleInvoice, printPreviewModal };
}
