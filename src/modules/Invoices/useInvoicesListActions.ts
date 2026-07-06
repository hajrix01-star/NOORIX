import { useCallback } from 'react';
import { fetchAllInvoicesForExport } from '../../services/api';
import { exportToExcel } from '../../utils/exportUtils';
import { openPrintWindow } from '../../utils/printUtils';
import { toYmd } from '../../utils/saudiDate';
import { buildPrintTableHtml } from '../../utils/printTableHtml';
import { MAX_VAULT_SLOTS } from './invoicesListScreenHelpers';
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

type Translate = (key: string, ...args: unknown[]) => string;
type ToastVariant = 'success' | 'error' | 'info' | 'warning' | string;
type UrlExtraFilters = { categoryId: string; expenseLineId: string };
type InvoiceListActionTotals = { count: number; net: unknown; tax: unknown; total: unknown };

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

function buildExportFetchParams(params: InvoiceListActionParams): InvoiceListFetchParams {
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

  const handleExportExcel = useCallback(async () => {
    if (!companyId || displayedTotal === 0) return;
    setExportBusy(true);
    try {
      const all = await fetchAllInvoicesForExport(buildExportFetchParams(params));
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
  ]);

  const handlePrintInvoices = useCallback(async () => {
    if (!companyId || displayedTotal === 0) return;
    setExportBusy(true);
    try {
      const all = await fetchAllInvoicesForExport(buildExportFetchParams(params));
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
      openPrintWindow({
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
  ]);

  return { handleExportExcel, handlePrintInvoices };
}
