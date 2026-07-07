import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDebouncedValue } from '../../../ui';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useSales } from '../../../hooks/useSales';
import { useSalesChannels } from '../../../hooks/useSalesChannels';
import { useDateFilter } from '../../../ui/date';
import { getCompany, getDailySalesSummaries, fetchAllSalesSummariesForExport } from '../../../services/api';
import { formatSaudiDate, formatSaudiWeekdayName, getSaudiToday, toYmd } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { exportToExcel, exportToPdf } from '../../../utils/exportUtils';
import { buildPrintRecordsTableHtml } from '../../../utils/printTableHtml';
import { openPrintWindow } from '../../../utils/printUtils';
import { formatSalesForExport } from '../../../utils/importTemplates';
import { hasPermission, PERMISSIONS } from '../../../constants/permissions';
import { buildActiveCancelledStatusMap } from '../../../constants/badgeMaps';
import { salesKeys, companyKeys } from '../../../services/queryKeys';
import { addCalendarDaysYmd } from '../dailySalesScreenUtils';
import type {
  SalesListShiftFilter,
  SalesSummariesPage,
  SalesSummaryDayRow,
  SalesSummaryItem,
  UpdateSalesSummaryBody,
} from '../../../types/api/domains/sales';
import { getSalesShiftLabel, resolveSalesSummaryShift } from '../constants/salesShift';
import {
  buildSummaryChannelWhatsAppLines,
  buildVaultLookup,
} from '../utils/salesWhatsAppChannels';
import { computeAppShare, type AppShareResult } from '../utils/salesAppShare';
import { appendAppShareWaLines } from '../utils/salesWhatsAppAppShare';
import { fetchMonthAppShare } from '../utils/fetchMonthAppShare';
import {
  waCashLine,
  waCustomersLine,
  waMetaLine,
  waMetricLine,
  waAvgSaleMetricLine,
  waReportHeader,
  waShiftSectionTitle,
  waSubheading,
} from '../utils/salesWhatsAppFormat';

const PAGE_SIZE = 50;

export type DailySalesSummary = SalesSummaryItem;
export type DailySalesTableRow = SalesSummaryDayRow;
export type DailySalesEditBody = UpdateSalesSummaryBody;

type CompanySalesSettings = {
  vatEnabledForSales?: boolean | null;
  vatRatePercent?: number | string | null;
};

const ALLOWED_SORT = new Set(['summaryNumber', 'transactionDate', 'totalAmount', 'customerCount']);

export function useDailySalesScreen() {
  const queryClient = useQueryClient();
  const { activeCompanyId, userRole, userPermissions, companies } = useApp();
  const { t, lang } = useTranslation();
  const [searchParams] = useSearchParams();
  const urlDrillKeyRef = useRef('');
  const companyId = activeCompanyId ?? '';
  const dateFilter = useDateFilter();
  const activeCo = companies?.find((c) => c.id === activeCompanyId);
  const companyName = (lang === 'en' ? (activeCo?.nameEn || activeCo?.nameAr) : (activeCo?.nameAr || activeCo?.nameEn)) || '';
  const logoUrl = activeCo?.logoUrl || '';

  const { showToast } = useToast();
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingSummary, setEditingSummary] = useState<DailySalesTableRow | null>(null);
  const [listPage, setListPage] = useState(1);
  const qInit = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(qInit);
  const debouncedQRaw = useDebouncedValue(searchInput.trim(), 300);
  const [sortKey, setSortKey] = useState('transactionDate');
  const [sortDir, setSortDir] = useState('desc');
  const [exportBusy, setExportBusy] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  /** افتراضي: الملخصات الملغاة مخفية (لا يُرسل includeCancelled للـ API) */
  const [showCancelledSales, setShowCancelledSales] = useState(false);
  const [selectedShift, setSelectedShift] = useState<SalesListShiftFilter>('any');

  const salesFullHistory = hasPermission(userRole, PERMISSIONS.SALES_FULL_HISTORY, userPermissions);
  const salesViewSummariesList = hasPermission(userRole, PERMISSIONS.SALES_VIEW_SUMMARIES_LIST, userPermissions);

  const { createSummary, createSummaryBatch, updateSummary, deleteSummary } = useSales({
    companyId,
    startDate: dateFilter.startDate,
    endDate: dateFilter.endDate,
    fetchList: false,
  });
  const {
    salesChannels,
    isLoading: salesChannelsLoading,
    isError: salesChannelsHasError,
    error: salesChannelsError,
    refetch: refetchSalesChannels,
  } = useSalesChannels(companyId);

  useEffect(() => {
    if (salesFullHistory) return;
    setSearchInput('');
  }, [salesFullHistory, companyId]);

  useEffect(() => {
    if (salesFullHistory || !companyId) return;
    const end = getSaudiToday();
    const start = addCalendarDaysYmd(end, -6);
    dateFilter.setMode('range');
    dateFilter.setRangeStart(start);
    dateFilter.setRangeEnd(end);
  }, [salesFullHistory, companyId]);

  const debouncedQEffective = salesFullHistory ? debouncedQRaw : '';

  useEffect(() => {
    setListPage(1);
  }, [debouncedQEffective, dateFilter.startDate, dateFilter.endDate, showCancelledSales, selectedShift]);

  useEffect(() => {
    setSelectedShift('any');
  }, [companyId]);

  useEffect(() => {
    if (!salesFullHistory) return;
    const keys = ['from', 'to', 'q'];
    const parts = keys.map((k) => searchParams.get(k) || '');
    const drillKey = parts.join('\u001f');
    if (!parts.some(Boolean)) {
      urlDrillKeyRef.current = '';
      return;
    }
    if (urlDrillKeyRef.current === drillKey) return;
    urlDrillKeyRef.current = drillKey;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const q = searchParams.get('q') || '';
    if (from && to) {
      dateFilter.setMode('range');
      dateFilter.setRangeStart(toYmd(from));
      dateFilter.setRangeEnd(toYmd(to));
    }
    if (q) {
      setSearchInput(q);
    }
  }, [searchParams, salesFullHistory, dateFilter]);

  const {
    data: salesPage,
    isLoading: summariesLoading,
    error: summariesError,
  } = useApiQuery<SalesSummariesPage>({
    queryKey: salesKeys.summariesPaged(
      companyId,
      dateFilter.startDate,
      dateFilter.endDate,
      listPage,
      PAGE_SIZE,
      debouncedQEffective,
      sortKey,
      sortDir,
      salesViewSummariesList,
      showCancelledSales,
      selectedShift,
    ),
    queryFn: () =>
      getDailySalesSummaries(
        companyId,
        dateFilter.startDate,
        dateFilter.endDate,
        listPage,
        PAGE_SIZE,
        debouncedQEffective,
        sortKey,
        sortDir,
        showCancelledSales,
        selectedShift,
      ),
    fallbackMessage: 'فشل تحميل المبيعات',
    enabled: !!companyId && salesViewSummariesList,
  });

  const salesPageData = salesPage;
  const listTotal = salesPageData ? salesPageData.total : 0;
  const pagedDayRows = salesPageData ? salesPageData.dayRows : [];
  const pageSummary = salesPageData ? salesPageData.pageSummary : null;

  const { data: companyData } = useApiQuery<CompanySalesSettings>({
    queryKey: companyKeys.single(companyId),
    queryFn: () => getCompany(companyId),
    fallbackMessage: t('loadingError'),
    enabled: !!companyId,
  });
  const vatEnabled = !!companyData?.vatEnabledForSales;
  const vatRate = companyData?.vatRatePercent != null ? Number(companyData.vatRatePercent) / 100 : 0.15;

  const vaultById = useMemo(() => buildVaultLookup(salesChannels), [salesChannels]);

  const buildWhatsAppText = useCallback((s: DailySalesSummary, monthAppShare?: AppShareResult) => {
    const cc = s.customerCount || 0;
    const total = Number(s.totalAmount || 0);
    const name = (companyName || '').trim();
    const dateRaw = formatSaudiDate(s.transactionDate);
    let dateWithWeekday = dateRaw;
    if (dateRaw !== '—') {
      const wd = formatSaudiWeekdayName(s.transactionDate, lang);
      if (wd) dateWithWeekday = `${dateRaw} ${wd}`;
    }

    const shift = resolveSalesSummaryShift(s);
    const shiftKind = shift === 'morning' ? 'morning' as const : shift === 'evening' ? 'evening' as const : 'fullDay' as const;

    const lines = [
      waReportHeader(t('salesWhatsAppReportTitle'), name),
      waMetaLine(t('salesWhatsAppDateLine'), dateWithWeekday),
      waMetaLine(t('salesWhatsAppSummaryRef'), String(s.summaryNumber ?? '—')),
      waShiftSectionTitle(shiftKind, `${t('salesWhatsAppShiftLine')} ${getSalesShiftLabel(shift, t)}`),
    ];

    const channelLines = buildSummaryChannelWhatsAppLines(s.channels, lang, vaultById);
    if (channelLines.length > 0) {
      lines.push(waSubheading(t('salesWhatsAppChannelsHeader')));
      lines.push(...channelLines);
    } else {
      lines.push(`  ${t('salesWhatsAppNoChannels')}`);
    }

    lines.push(
      '',
      waMetricLine(t('salesWhatsAppTotalLine'), `${fmt(total)} SR`),
      waCustomersLine(t('salesWhatsAppCustomersLine'), fmt(cc, 0)),
      waAvgSaleMetricLine(t('salesWhatsAppAvgInvoiceLine'), total, cc),
    );

    const summaryShare = computeAppShare(s.channels, total, vaultById);
    appendAppShareWaLines(lines, summaryShare, t('salesWhatsAppAppShareLine'));
    if (monthAppShare) {
      appendAppShareWaLines(lines, monthAppShare, t('salesWhatsAppAppShareMonthLine'), { percentOnly: true });
    }

    if (Number(s.cashOnHand) > 0) {
      lines.push(waCashLine(t('salesWhatsAppCashLine'), `${fmt(s.cashOnHand)} SR`));
    }
    if (s.notes?.trim()) {
      lines.push('', `${t('salesShareNotes')}: ${s.notes.trim()}`);
    }
    return lines.join('\n');
  }, [companyName, lang, t, vaultById]);

  const openWhatsApp = useCallback(async (s: DailySalesSummary | DailySalesTableRow) => {
    const group = 'summaries' in s ? s.summaries : undefined;
    if (Array.isArray(group) && group.length > 1) {
      const parts = await Promise.all(group.map(async (item) => {
        const monthAppShare = companyId
          ? await fetchMonthAppShare(companyId, item.transactionDate, vaultById)
          : undefined;
        return buildWhatsAppText(item, monthAppShare);
      }));
      window.open(`https://wa.me/?text=${encodeURIComponent(parts.join('\n\n'))}`, '_blank');
      return;
    }
    const monthAppShare = companyId
      ? await fetchMonthAppShare(companyId, s.transactionDate, vaultById)
      : undefined;
    window.open(`https://wa.me/?text=${encodeURIComponent(buildWhatsAppText(s, monthAppShare))}`, '_blank');
  }, [buildWhatsAppText, companyId, vaultById]);

  async function handleEditSave(body: DailySalesEditBody | Array<{ id: string; body: DailySalesEditBody }>) {
    if (!editingSummary || !companyId) return;
    if (Array.isArray(body)) {
      for (const item of body) {
        const res = await updateSummary.mutateAsync({
          id: item.id,
          body: item.body,
          companyId,
        });
        if (res?.success === false) {
          throw new Error(res?.error || t('updateFailed'));
        }
      }
    } else {
      const targetId = editingSummary.summaries.length === 1 ? editingSummary.summaries[0].id : editingSummary.id;
      const res = await updateSummary.mutateAsync({
        id: targetId,
        body,
        companyId,
      });
      if (res?.success === false) {
        throw new Error(res?.error || t('updateFailed'));
      }
    }
    showToast(t('updateSuccess'), 'success');
    setEditingSummary(null);
  }

  const handleDeleteSummary = useCallback((s: DailySalesSummary | DailySalesTableRow) => {
    if (!companyId) return;
    const summaries = 'summaries' in s && s.summaries.length ? s.summaries : [s];
    const label = summaries.length > 1
      ? `${formatSaudiDate(s.transactionDate)} (${summaries.map((x) => x.summaryNumber).filter(Boolean).join(', ')})`
      : s.summaryNumber;
    if (!window.confirm(t('deleteSummaryConfirm', label))) return;
    Promise.all(summaries.map((item) => deleteSummary.mutateAsync({ id: item.id, companyId })))
      .then(() => showToast(t('summaryDeleted'), 'success'))
      .catch((e: Error) => showToast(e?.message || t('deleteFailed'), 'error'));
  }, [companyId, deleteSummary, t, showToast]);

  const hasCompany = !!companyId;

  const STATUS_MAP = useMemo(() => buildActiveCancelledStatusMap(t), [t]);

  const tableData = pagedDayRows;

  const toggleSort = useCallback((key: string) => {
    if (!ALLOWED_SORT.has(key)) return;
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('desc');
      return key;
    });
    setListPage(1);
  }, []);

  const displayedTotal = listTotal;
  const activeRowCount = pageSummary ? pageSummary.rowCount : 0;
  const totalAmountSum = pageSummary ? pageSummary.totalAmount : 0;
  const totalCustomers = pageSummary ? pageSummary.customerCount : 0;
  const avgPerCustomer = pageSummary ? pageSummary.avgPerCustomer : 0;

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

  function mapSummariesToExportRows(rows: DailySalesSummary[]) {
    return rows.map((s) => {
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
    });
  }

  async function handleExportExcel() {
    if (!companyId) return;
    setExportBusy(true);
    try {
      const all = await fetchAllSalesSummariesForExport(
        companyId,
        dateFilter.startDate,
        dateFilter.endDate,
        debouncedQEffective,
        sortKey,
        sortDir,
        showCancelledSales,
        selectedShift,
      );
      const exportData = mapSummariesToExportRows(all);
      exportToExcel({
        columns: exportColumns,
        data: exportData,
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
  }

  async function handleExportPdf() {
    if (!companyId) return;
    setExportBusy(true);
    try {
      const all = await fetchAllSalesSummariesForExport(
        companyId,
        dateFilter.startDate,
        dateFilter.endDate,
        debouncedQEffective,
        sortKey,
        sortDir,
        showCancelledSales,
        selectedShift,
      );
      const exportData = mapSummariesToExportRows(all);
      exportToPdf({
        columns: exportColumns,
        data: exportData,
        filename: `sales-summaries-${dateFilter.startDate || 'all'}-${dateFilter.endDate || 'all'}`,
        companyName,
        title: `${t('salesDailySummary')} — ${dateFilter.label}`,
        logoUrl,
      });
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('saveFailed'), 'error');
    } finally {
      setExportBusy(false);
    }
  }

  async function handlePrint() {
    if (!companyId) return;
    setExportBusy(true);
    let allFilteredData: DailySalesSummary[] = [];
    try {
      allFilteredData = await fetchAllSalesSummariesForExport(
        companyId,
        dateFilter.startDate,
        dateFilter.endDate,
        debouncedQEffective,
        sortKey,
        sortDir,
        showCancelledSales,
        selectedShift,
      );
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('saveFailed'), 'error');
      setExportBusy(false);
      return;
    } finally {
      setExportBusy(false);
    }
    const printRows = allFilteredData.map((s) => {
      const ch = (s.channels || []).map((c) => `${vaultDisplayName(c.vault, lang)}: ${fmt(c.amount)}`).join(' | ');
      return {
        [t('summaryNumber')]: String(s.summaryNumber ?? ''),
        [t('transactionDate')]: formatSaudiDate(s.transactionDate),
        [t('salesShiftLabel')]: getSalesShiftLabel(resolveSalesSummaryShift(s), t),
        [t('salesChannels')]: ch || '—',
        [t('customers')]: s.customerCount,
        [t('total')]: fmt(s.totalAmount),
        [t('avgPerOrder')]: fmt(s.avgPerCustomer),
        [t('statusLabel')]: s.status === 'cancelled' ? t('statusCancelled') : t('statusActive'),
      };
    });
    openPrintWindow({
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
  }

  const importExportFetcher = useCallback(async () => {
    const list = await fetchAllSalesSummariesForExport(
      companyId,
      dateFilter.startDate,
      dateFilter.endDate,
      debouncedQEffective,
      sortKey,
      sortDir,
      showCancelledSales,
      selectedShift,
    );
    return list.map(formatSalesForExport);
  }, [companyId, dateFilter.startDate, dateFilter.endDate, debouncedQEffective, sortKey, sortDir, showCancelledSales, selectedShift]);

  const handleImportSuccess = useCallback(() => {
    invalidateOnFinancialMutation(queryClient);
    showToast('تم استيراد ملخصات المبيعات بنجاح', 'success');
  }, [queryClient, showToast]);

  const salesChannelsErrorMessage = salesChannelsHasError
    ? (salesChannelsError?.message || t('salesChannelsLoadFailed'))
    : '';

  return {
    PAGE_SIZE,
    t,
    lang,
    userRole,
    companyId,
    companyName,
    logoUrl,
    hasCompany,
    salesFullHistory,
    salesViewSummariesList,
    dateFilter,
    showEntryModal,
    setShowEntryModal,
    editingSummary,
    setEditingSummary,
    listPage,
    setListPage,
    searchInput,
    setSearchInput,
    sortKey,
    sortDir,
    toggleSort,
    exportBusy,
    showImportExport,
    setShowImportExport,
    showCancelledSales,
    setShowCancelledSales,
    selectedShift,
    setSelectedShift,
    salesChannels,
    salesChannelsLoading,
    salesChannelsHasError,
    salesChannelsError,
    salesChannelsErrorMessage,
    refetchSalesChannels,
    createSummary,
    createSummaryBatch,
    updateSummary,
    summariesLoading,
    summariesError,
    vatEnabled,
    vatRate,
    openWhatsApp,
    handleEditSave,
    handleDeleteSummary,
    STATUS_MAP,
    tableData,
    activeRowCount,
    displayedTotal,
    totalAmountSum,
    totalCustomers,
    avgPerCustomer,
    handleExportExcel,
    handleExportPdf,
    handlePrint,
    importExportFetcher,
    handleImportSuccess,
    showToast,
  };
}
