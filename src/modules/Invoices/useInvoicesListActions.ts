import { useCallback } from 'react';
import {
  fetchAllInvoicesForExport,
  fetchAllSalesSummariesForExport,
  getInvoices,
  throwIfApiFailed,
} from '../../services/api';
import { exportToExcel } from '../../utils/exportUtils';
import { openPrintWindow } from '../../utils/printUtils';
import { toYmd } from '../../utils/saudiDate';
import { MAX_VAULT_SLOTS } from './invoicesListScreenHelpers';
import {
  buildInvoicesCashReportBody,
  INVOICES_CASH_REPORT_PRINT_EXTRA_CSS,
} from './utils/buildInvoicesCashReportPrint';

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
  vaultsList: Array<{ id?: string; type?: string }>;
  serverAll: { count: number; net: unknown; tax: unknown; total: unknown };
};

const escapeHtml = (value: any) =>
  String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
    vaultsList,
    serverAll,
  } = params;

  const handleExportExcel = useCallback(async () => {
    if (!companyId || displayedTotal === 0) return;
    setExportBusy(true);
    try {
      const all = await fetchAllInvoicesForExport({
        companyId,
        startDate: invoiceQueryStartDate,
        endDate: invoiceQueryEndDate,
        kind: kindForApi,
        sortBy: sortKey,
        sortDir,
        supplierId: filterSupplierId || undefined,
        q: debouncedQ || undefined,
        categoryId: urlExtra.categoryId || undefined,
        expenseLineId: urlExtra.expenseLineId || undefined,
        includeCancelled: showCancelled,
        hasNotes: filterHasNotesOnly || undefined,
        vaultId: filterVaultId || undefined,
        batchId: invoiceBatchIdFromUrl || undefined,
        createdByUserId: filterCreatedByUserId || undefined,
      });
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

  const handlePrintCashReport = useCallback(async () => {
    if (!companyId) return;
    setExportBusy(true);
    try {
      const invRes = await getInvoices(
        companyId,
        invoiceQueryStartDate,
        invoiceQueryEndDate,
        1,
        1,
        null,
        null,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      throwIfApiFailed(invRes, t('invoicesCashReportLoadFailed'));
      const pack = invRes.data as {
        inflowByVault?: { vaultId: string; nameAr?: string; nameEn?: string; total: string; outflow: string; remainder: string }[];
      };
      const cashVaultIds = new Set(
        (vaultsList as { id?: string; type?: string }[])
          .filter((v) => String(v.type || '').toLowerCase() === 'cash')
          .map((v) => String(v.id)),
      );
      const cashRows = (pack?.inflowByVault ?? []).filter((r) => r.vaultId && cashVaultIds.has(r.vaultId));
      let summaries: unknown[] = [];
      try {
        summaries = await fetchAllSalesSummariesForExport(
          companyId,
          invoiceQueryStartDate,
          invoiceQueryEndDate,
          undefined,
          'transactionDate',
          'desc',
          false,
        );
      } catch {
        summaries = [];
      }

      const cashOnHandSum = (summaries as { cashOnHand?: unknown }[]).reduce(
        (acc, s) => acc + Number(s.cashOnHand ?? 0),
        0,
      );
      const vaultRows = cashRows.map((r) => {
        const n = lang === 'en' ? r.nameEn || r.nameAr : r.nameAr || r.nameEn;
        return {
          vaultName: n || '—',
          inflow: fmt(Number(r.total ?? 0)),
          outflow: fmt(Number(r.outflow ?? 0)),
          remainder: fmt(Number(r.remainder ?? 0)),
        };
      });

      const totals = cashRows.reduce(
        (acc, row) => ({
          inflow: acc.inflow + Number(row.total ?? 0),
          outflow: acc.outflow + Number(row.outflow ?? 0),
          remainder: acc.remainder + Number(row.remainder ?? 0),
        }),
        { inflow: 0, outflow: 0, remainder: 0 },
      );

      const periodLine =
        fromUrl && toUrl
          ? `${fromUrl} — ${toUrl}`
          : `${toYmd(invoiceQueryStartDate) || '—'} — ${toYmd(invoiceQueryEndDate) || '—'}`;

      const body = buildInvoicesCashReportBody(
        {
          reportTitle: t('invoicesCashReportTitle'),
          subtitle: t('invoicesCashReportSubtitle'),
          periodLine,
          scopeNote: t('invoicesCashReportScope'),
          vaultSectionTitle: t('invoicesCashReportVaultSection'),
          colVault: t('invoicesCashReportColVault'),
          colIn: t('invoicesCashReportColIn'),
          colOut: t('invoicesCashReportColOut'),
          colRemain: t('invoicesCashReportColRemain'),
          totalsTitle: t('invoicesCashReportTotalsRow'),
          salesCashOnHandTitle: t('invoicesCashReportSalesCashOnHandTitle'),
          salesCashOnHandHint: t('invoicesCashReportSalesCashOnHandHint'),
          summariesCountLabel: t('invoicesCashReportSummariesCount'),
          noCashVaults: t('invoicesCashReportNoCashVaults'),
        },
        vaultRows,
        {
          inflow: fmt(totals.inflow),
          outflow: fmt(totals.outflow),
          remainder: fmt(totals.remainder),
        },
        fmt(cashOnHandSum),
        summaries.length,
      );

      openPrintWindow({
        title: t('invoicesCashReportTitle'),
        companyName,
        subtitle: `${t('invoicesTitle')} — ${(fromUrl && toUrl ? `${fromUrl} — ${toUrl}` : dateFilterLabel) || periodLine}`,
        logoUrl,
        landscape: false,
        extraCss: INVOICES_CASH_REPORT_PRINT_EXTRA_CSS,
        body,
      });
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('invoicesCashReportLoadFailed'), 'error');
    } finally {
      setExportBusy(false);
    }
  }, [
    companyId,
    invoiceQueryStartDate,
    invoiceQueryEndDate,
    vaultsList,
    lang,
    fmt,
    t,
    companyName,
    logoUrl,
    fromUrl,
    toUrl,
    dateFilterLabel,
    showToast,
    setExportBusy,
  ]);

  const handlePrintInvoices = useCallback(async () => {
    if (!companyId || displayedTotal === 0) return;
    setExportBusy(true);
    try {
      const all = await fetchAllInvoicesForExport({
        companyId,
        startDate: invoiceQueryStartDate,
        endDate: invoiceQueryEndDate,
        kind: kindForApi,
        sortBy: sortKey,
        sortDir,
        supplierId: filterSupplierId || undefined,
        q: debouncedQ || undefined,
        categoryId: urlExtra.categoryId || undefined,
        expenseLineId: urlExtra.expenseLineId || undefined,
        includeCancelled: showCancelled,
        hasNotes: filterHasNotesOnly || undefined,
        vaultId: filterVaultId || undefined,
        batchId: invoiceBatchIdFromUrl || undefined,
        createdByUserId: filterCreatedByUserId || undefined,
      });
      const rowsHtml = all
        .map((inv: any) => {
          const row = mapInvoiceToExportRow(inv);
          return `<tr>${exportColumnDefs.map((col) => `<td>${escapeHtml(row[col.key])}</td>`).join('')}</tr>`;
        })
        .join('');
      const head = `<tr>${exportColumnDefs.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('')}</tr>`;
      const baseMetaCols = 6;
      const vaultBlockCols = MAX_VAULT_SLOTS * 3;
      const foot = `<tr><td colspan="${baseMetaCols}">${escapeHtml(t('totalInvoices', serverAll.count))}</td><td colspan="${vaultBlockCols}"></td><td>${escapeHtml(fmt(Number(serverAll.net)))} SR</td><td>${escapeHtml(fmt(Number(serverAll.tax)))} SR</td><td>${escapeHtml(fmt(Number(serverAll.total)))} SR</td><td colspan="2"></td></tr>`;
      const table = `<table><thead>${head}</thead><tbody>${rowsHtml || `<tr><td colspan="${exportColumnDefs.length}">${escapeHtml(t('noInvoicesInPeriod'))}</td></tr>`}</tbody><tfoot>${foot}</tfoot></table>`;
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

  return { handleExportExcel, handlePrintCashReport, handlePrintInvoices };
}
