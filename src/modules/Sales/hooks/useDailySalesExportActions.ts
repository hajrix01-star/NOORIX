import { useCallback, useMemo, useState } from 'react';
import { fetchAllSalesSummariesForExport } from '../../../services/api';
import { exportToExcel } from '../../../utils/exportUtils';
import { fmt } from '../../../utils/format';
import { formatSalesForExport } from '../../../utils/importTemplates';
import { buildPrintRecordsTableHtml } from '../../../utils/printTableHtml';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { usePrintPreview } from '../../../ui';
import type { SalesListShiftFilter, SalesSummaryItem } from '../../../types/api/domains/sales';
import { getSalesShiftLabel, resolveSalesSummaryShift } from '../constants/salesShift';

type TranslateFn = (key: string, ...args: Array<string | number>) => string;

type DailySalesExportDateFilter = {
  startDate: string;
  endDate: string;
  label: string;
};

type UseDailySalesExportActionsOptions = {
  companyId: string;
  companyName: string;
  logoUrl: string;
  lang: string;
  t: TranslateFn;
  dateFilter: DailySalesExportDateFilter;
  debouncedQEffective: string;
  sortKey: string;
  sortDir: string;
  showCancelledSales: boolean;
  selectedShift: SalesListShiftFilter;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  openPrintDocumentPreview: ReturnType<typeof usePrintPreview>['openPrintDocumentPreview'];
};

export function useDailySalesExportActions({
  companyId,
  companyName,
  logoUrl,
  lang,
  t,
  dateFilter,
  debouncedQEffective,
  sortKey,
  sortDir,
  showCancelledSales,
  selectedShift,
  showToast,
  openPrintDocumentPreview,
}: UseDailySalesExportActionsOptions) {
  const [exportBusy, setExportBusy] = useState(false);
  const exportColumns = useMemo(() => [
    { key: 'summaryNumber', label: t('summaryNumber') },
    { key: 'transactionDate', label: t('transactionDate') },
    { key: 'shiftLabel', label: t('salesShiftLabel') },
    { key: 'channelsText', label: t('salesChannels') },
    { key: 'customerCount', label: t('customers') },
    { key: 'totalAmount', label: t('total') },
    { key: 'avgPerCustomer', label: t('avgPerOrder') },
    { key: 'status', label: t('statusLabel') },
  ], [t]);

  const fetchFilteredSummaries = useCallback(
    () => fetchAllSalesSummariesForExport(
      companyId,
      dateFilter.startDate,
      dateFilter.endDate,
      debouncedQEffective,
      sortKey,
      sortDir,
      showCancelledSales,
      selectedShift,
    ),
    [companyId, dateFilter.startDate, dateFilter.endDate, debouncedQEffective, sortKey, sortDir, showCancelledSales, selectedShift],
  );

  const mapSummariesToExportRows = useCallback((rows: SalesSummaryItem[]) => rows.map((s) => {
    const channelsText = (s.channels || []).map((ch) => `${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount)}`).join(' | ');
    return {
      summaryNumber: s.summaryNumber,
      transactionDate: formatSaudiDate(s.transactionDate),
      shiftLabel: getSalesShiftLabel(resolveSalesSummaryShift(s), t),
      channelsText,
      customerCount: s.customerCount,
      totalAmount: fmt(s.totalAmount),
      avgPerCustomer: fmt(s.avgPerCustomer),
      status: s.status === 'cancelled' ? t('statusCancelled') : t('statusActive'),
    };
  }), [lang, t]);

  const handleExportExcel = useCallback(async () => {
    if (!companyId) return;
    setExportBusy(true);
    try {
      exportToExcel({
        columns: exportColumns,
        data: mapSummariesToExportRows(await fetchFilteredSummaries()),
        filename: `sales-summaries-${dateFilter.startDate || 'all'}-${dateFilter.endDate || 'all'}.xlsx`,
        companyName,
        title: `${t('salesDailySummary')} — ${dateFilter.label}`,
        logoUrl,
      });
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('saveFailed'), 'error');
    } finally {
      setExportBusy(false);
    }
  }, [companyId, companyName, dateFilter.endDate, dateFilter.label, dateFilter.startDate, exportColumns, fetchFilteredSummaries, logoUrl, mapSummariesToExportRows, showToast, t]);

  const handlePrint = useCallback(async () => {
    if (!companyId) return;
    setExportBusy(true);
    let allFilteredData: SalesSummaryItem[] = [];
    try {
      allFilteredData = await fetchFilteredSummaries();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('saveFailed'), 'error');
      setExportBusy(false);
      return;
    } finally {
      setExportBusy(false);
    }
    const printRows = allFilteredData.map((s) => {
      const channels = (s.channels || []).map((c) => `${vaultDisplayName(c.vault, lang)}: ${fmt(c.amount)}`).join(' | ');
      return {
        [t('summaryNumber')]: String(s.summaryNumber ?? ''),
        [t('transactionDate')]: formatSaudiDate(s.transactionDate),
        [t('salesShiftLabel')]: getSalesShiftLabel(resolveSalesSummaryShift(s), t),
        [t('salesChannels')]: channels || '—',
        [t('customers')]: s.customerCount,
        [t('total')]: fmt(s.totalAmount),
        [t('avgPerOrder')]: fmt(s.avgPerCustomer),
        [t('statusLabel')]: s.status === 'cancelled' ? t('statusCancelled') : t('statusActive'),
      };
    });
    openPrintDocumentPreview({
      title: t('salesDailySummary'),
      companyName: companyName || 'الشركة',
      subtitle: `${t('salesDailySummary')} — ${dateFilter.label || ''}`,
      logoUrl: logoUrl || '',
      body: buildPrintRecordsTableHtml({
        records: printRows,
        emptyMessage: t('noSummariesInPeriod'),
        numericKeys: [t('customers'), t('total'), t('avgPerOrder')],
      }),
    });
  }, [companyId, companyName, dateFilter.label, fetchFilteredSummaries, lang, logoUrl, openPrintDocumentPreview, showToast, t]);

  const importExportFetcher = useCallback(async () => {
    const list = await fetchFilteredSummaries();
    return list.map(formatSalesForExport);
  }, [fetchFilteredSummaries]);

  return {
    exportBusy,
    handleExportExcel,
    handlePrint,
    importExportFetcher,
  };
}
