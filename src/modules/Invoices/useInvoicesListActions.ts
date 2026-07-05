import { useCallback } from 'react';
import { fetchAllInvoicesForExport } from '../../services/api';
import { exportToExcel } from '../../utils/exportUtils';
import { openPrintWindow } from '../../utils/printUtils';
import { toYmd } from '../../utils/saudiDate';
import { buildPrintTableHtml } from '../../utils/printTableHtml';
import { MAX_VAULT_SLOTS } from './invoicesListScreenHelpers';
import { buildInvoiceListFetchParams } from './invoicesListQueryModel';

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
  sortDir: string;
  filterSupplierId: string;
  filterSupplierCategoryId: string;
  debouncedQ: string;
  urlExtra: { categoryId: string; expenseLineId: string };
  showCancelled: boolean;
  filterHasNotesOnly: boolean;
  filterVaultId: string;
  invoiceBatchIdFromUrl: string;
  filterCreatedByUserId: string;
  mapInvoiceToExportRow: (invoice: any) => Record<string, any>;
  exportColumnDefs: Array<{ key: string; label: string }>;
  companyName: string;
  logoUrl: string;
  lang: string;
  t: (key: string, ...args: any[]) => string;
  fmt: (value: number) => string;
  showToast: (message: string, variant?: any) => void;
  setExportBusy: (value: boolean) => void;
  serverAll: { count: number; net: unknown; tax: unknown; total: unknown };
};

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
      const all = await fetchAllInvoicesForExport(buildInvoiceListFetchParams({
        companyId,
        startDate: invoiceQueryStartDate,
        endDate: invoiceQueryEndDate,
        kind: kindForApi,
        sortBy: sortKey,
        sortDir,
        supplierId: filterSupplierId,
        supplierCategoryId: filterSupplierCategoryId,
        q: debouncedQ,
        categoryId: urlExtra.categoryId,
        expenseLineId: urlExtra.expenseLineId,
        includeCancelled: showCancelled,
        hasNotes: filterHasNotesOnly,
        vaultId: filterVaultId,
        batchId: invoiceBatchIdFromUrl,
        createdByUserId: filterCreatedByUserId,
      }));
      const rows = all.map(mapInvoiceToExportRow);
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
    } catch (e: any) {
      showToast(e?.message || t('exportFailed'), 'error');
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
      const all = await fetchAllInvoicesForExport(buildInvoiceListFetchParams({
        companyId,
        startDate: invoiceQueryStartDate,
        endDate: invoiceQueryEndDate,
        kind: kindForApi,
        sortBy: sortKey,
        sortDir,
        supplierId: filterSupplierId,
        supplierCategoryId: filterSupplierCategoryId,
        q: debouncedQ,
        categoryId: urlExtra.categoryId,
        expenseLineId: urlExtra.expenseLineId,
        includeCancelled: showCancelled,
        hasNotes: filterHasNotesOnly,
        vaultId: filterVaultId,
        batchId: invoiceBatchIdFromUrl,
        createdByUserId: filterCreatedByUserId,
      }));
      const rows = all.map((inv: any) => mapInvoiceToExportRow(inv));
      const baseMetaCols = 6;
      const vaultBlockCols = MAX_VAULT_SLOTS * 3;
      const table = buildPrintTableHtml({
        columns: exportColumnDefs.map((col) => ({ key: col.key, header: col.label })),
        rows,
        emptyMessage: t('noInvoicesInPeriod'),
        footerRows: [[
          { value: t('totalInvoices', serverAll.count), colSpan: baseMetaCols },
          { value: '', colSpan: vaultBlockCols },
          { value: `${fmt(Number(serverAll.net))} SR` },
          { value: `${fmt(Number(serverAll.tax))} SR` },
          { value: `${fmt(Number(serverAll.total))} SR` },
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
    } catch (e: any) {
      showToast(e?.message || t('exportFailed'), 'error');
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
