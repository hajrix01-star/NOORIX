import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useSales } from '../../../hooks/useSales';
import { useSalesChannels } from '../../../hooks/useSalesChannels';
import { useDateFilter } from '../../../hooks/useDateFilter';
import { getCompany, getDailySalesSummaries, fetchAllSalesSummariesForExport, throwIfApiFailed } from '../../../services/api';
import { formatSaudiDate, formatSaudiWeekdayName, getSaudiToday, toYmd } from '../../../utils/saudiDate';
import { fmt, sumAmounts } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { exportToExcel, exportToPdf } from '../../../utils/exportUtils';
import { openPrintWindow } from '../../../utils/printUtils';
import { formatSalesForExport } from '../../../utils/importTemplates';
import { hasPermission, PERMISSIONS } from '../../../constants/permissions';
import { buildActiveCancelledStatusMap } from '../../../constants/badgeMaps';
import { salesKeys, companyKeys } from '../../../services/queryKeys';
import { addCalendarDaysYmd } from '../dailySalesScreenUtils';
import type { DailySalesChannelEntry } from '../components/DailySalesChannelsChips';
import type { SalesListShiftFilter, SalesShiftValue } from '../constants/salesShift';
import { getSalesShiftLabel, parseSalesShiftValue } from '../constants/salesShift';

const PAGE_SIZE = 50;

export type DailySalesSummary = {
  id: string;
  summaryNumber?: string | number | null;
  transactionDate?: string | null;
  customerCount?: number | null;
  totalAmount?: number | string | null;
  cashOnHand?: number | string | null;
  notes?: string | null;
  status?: string | null;
  shift?: SalesShiftValue | string | null;
  channels?: DailySalesChannelEntry[] | null;
};

export type DailySalesTableRow = DailySalesSummary & {
  shift: SalesShiftValue;
  channelsText: string;
  avgPerCustomer: number;
} & Record<string, unknown>;

export type DailySalesEditBody = {
  transactionDate?: string;
  customerCount?: number;
  cashOnHand?: string;
  channels?: Array<{ vaultId: string; amount: string }>;
  notes?: string;
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
  const [editingSummary, setEditingSummary] = useState<DailySalesSummary | null>(null);
  const [listPage, setListPage] = useState(1);
  const qInit = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('q') || '') : '';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const {
    data: salesPage,
    isLoading: summariesLoading,
    error: summariesError,
  } = useQuery({
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
    queryFn: async () => {
      const res = await getDailySalesSummaries(
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
      );
      throwIfApiFailed(res, 'فشل تحميل المبيعات');
      return res.data;
    },
    enabled: !!companyId && salesViewSummariesList,
  });

  const salesPageData = salesPage as { total?: number; items?: DailySalesSummary[] } | undefined;
  const listTotal = salesPageData?.total ?? 0;
  const pagedSummaries = salesPageData?.items ?? [];

  const { data: companyData } = useQuery({
    queryKey: companyKeys.single(companyId),
    queryFn: async () => {
      const res = await getCompany(companyId);
      return res?.success ? res.data : null;
    },
    enabled: !!companyId,
  });
  const vatEnabled = !!companyData?.vatEnabledForSales;
  const vatRate = companyData?.vatRatePercent != null ? Number(companyData.vatRatePercent) / 100 : 0.15;

  const buildWhatsAppText = useCallback((s: DailySalesSummary) => {
    const cc = s.customerCount || 0;
    const total = Number(s.totalAmount || 0);
    const avg = cc > 0 ? (total / cc) : 0;
    const name = (companyName || '').trim();
    const dateRaw = formatSaudiDate(s.transactionDate);
    let dateWithWeekday = dateRaw;
    if (dateRaw !== '—') {
      const wd = formatSaudiWeekdayName(s.transactionDate, lang);
      if (wd) dateWithWeekday = `${dateRaw} ${wd}`;
    }

    const lines = [
      `${t('salesWhatsAppReportTitle')}${name ? ` ` + name : ''}`,
      `${t('salesWhatsAppDateLine')} ${dateWithWeekday}`,
      `${t('salesWhatsAppSummaryRef')} ${s.summaryNumber ?? '—'}`,
      `${t('salesWhatsAppShiftLine')} ${getSalesShiftLabel(s.shift, t)}`,
      '',
    ];

    const chList = s.channels || [];
    if (chList.length > 0) {
      chList.forEach((ch) => {
        lines.push(`• ${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount)} SR`);
      });
    } else {
      lines.push(t('salesWhatsAppNoChannels'));
    }

    lines.push(
      '',
      `${t('salesWhatsAppTotalLine')} ${fmt(total)} SR`,
      `${t('salesWhatsAppCustomersLine')} ${cc}`,
      `${t('salesWhatsAppAvgInvoiceLine')} ${fmt(avg)} SR`,
    );

    if (Number(s.cashOnHand) > 0) {
      lines.push(`${t('salesWhatsAppCashLine')} ${fmt(s.cashOnHand)} SR`);
    }
    if (s.notes?.trim()) {
      lines.push('', `${t('salesShareNotes')}: ${s.notes.trim()}`);
    }
    return lines.join('\n');
  }, [companyName, lang, t]);

  const openWhatsApp = useCallback((s: DailySalesSummary) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildWhatsAppText(s))}`, '_blank');
  }, [buildWhatsAppText]);

  async function handleEditSave(body: DailySalesEditBody) {
    if (!editingSummary || !companyId) return;
    const res = await updateSummary.mutateAsync({
      id: editingSummary.id,
      body,
      companyId,
    });
    if (res?.success === false) {
      throw new Error(res?.error || t('updateFailed'));
    }
    showToast(t('updateSuccess'), 'success');
    setEditingSummary(null);
  }

  const handleDeleteSummary = useCallback((s: DailySalesSummary) => {
    if (!companyId || !window.confirm(t('deleteSummaryConfirm', s.summaryNumber))) return;
    deleteSummary.mutate(
      { id: s.id, companyId },
      {
        onSuccess: () => showToast(t('summaryDeleted'), 'success'),
        onError: (e: Error) => showToast(e?.message || t('deleteFailed'), 'error'),
      },
    );
  }, [companyId, deleteSummary, t, showToast]);

  const hasCompany = !!companyId;

  const STATUS_MAP = useMemo(() => buildActiveCancelledStatusMap(t), [t]);

  const tableData = useMemo((): DailySalesTableRow[] => pagedSummaries.map((s) => {
    const total = Number(s.totalAmount || 0);
    const cc = s.customerCount || 0;
    const channelsText = (s.channels || []).map((ch) => `${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount)}`).join(' | ');
    return {
      ...s,
      shift: parseSalesShiftValue(s.shift, 'all'),
      channelsText,
      avgPerCustomer: cc > 0 ? total / cc : 0,
    };
  }), [pagedSummaries, lang]);

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

  const activeOnly = tableData.filter((s) => s.status !== 'cancelled');
  const displayedTotal = listTotal;
  const totalAmountSum = sumAmounts(activeOnly, 'totalAmount');
  const totalCustomers = activeOnly.reduce((sum, s) => sum + (s.customerCount || 0), 0);

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
      const total = Number(s.totalAmount || 0);
      const cc = s.customerCount || 0;
      const channelsText = (s.channels || []).map((ch) => `${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount)}`).join(' | ');
      return {
        summaryNumber: s.summaryNumber,
        transactionDate: formatSaudiDate(s.transactionDate),
        shiftLabel: getSalesShiftLabel(s.shift, t),
        channelsText,
        customerCount: cc,
        totalAmount: fmt(total),
        avgPerCustomer: cc > 0 ? fmt(total / cc) : '0.00',
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
      const exportData = mapSummariesToExportRows(all as DailySalesSummary[]);
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
      const exportData = mapSummariesToExportRows(all as DailySalesSummary[]);
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
      ) as DailySalesSummary[];
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('saveFailed'), 'error');
      setExportBusy(false);
      return;
    } finally {
      setExportBusy(false);
    }
    const channelsRows = allFilteredData.map((s) => {
      const ch = (s.channels || []).map((c) => `${vaultDisplayName(c.vault, lang)}: ${fmt(c.amount)}`).join(' | ');
      const total = Number(s.totalAmount || 0);
      const cc = s.customerCount || 0;
      return `<tr><td>${String(s.summaryNumber ?? '').replace(/</g, '&lt;')}</td><td>${formatSaudiDate(s.transactionDate)}</td><td>${getSalesShiftLabel(s.shift, t)}</td><td>${(ch || '—').replace(/</g, '&lt;')}</td><td>${cc}</td><td>${fmt(total)}</td><td>${cc > 0 ? fmt(total / cc) : '0.00'}</td><td>${s.status === 'cancelled' ? t('statusCancelled') : t('statusActive')}</td></tr>`;
    }).join('');
    openPrintWindow({
      title: t('salesDailySummary'),
      companyName: companyName || 'الشركة',
      subtitle: `${t('salesDailySummary')} — ${dateFilter.label || ''}`,
      logoUrl: logoUrl || '',
      body: `<table><thead><tr><th>${t('summaryNumber')}</th><th>${t('transactionDate')}</th><th>${t('salesShiftLabel')}</th><th>${t('salesChannels')}</th><th>${t('customers')}</th><th>${t('total')}</th><th>${t('avgPerOrder')}</th><th>${t('statusLabel')}</th></tr></thead><tbody>${channelsRows || '<tr><td colspan="8">' + t('noSummariesInPeriod') + '</td></tr>'}</tbody></table>`,
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
    return (list as Record<string, unknown>[]).map(formatSalesForExport);
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
    activeOnly,
    displayedTotal,
    totalAmountSum,
    totalCustomers,
    handleExportExcel,
    handleExportPdf,
    handlePrint,
    importExportFetcher,
    handleImportSuccess,
    showToast,
  };
}
