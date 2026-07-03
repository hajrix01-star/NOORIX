import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useSales } from '../../../hooks/useSales';
import { useSalesChannels } from '../../../hooks/useSalesChannels';
import { useDateFilter } from '../../../hooks/useDateFilter';
import { getCompany, getDailySalesSummaries, fetchAllSalesSummariesForExport } from '../../../services/api';
import { formatSaudiDate, formatSaudiWeekdayName, getSaudiToday, toYmd } from '../../../utils/saudiDate';
import { fmt, sumAmounts } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { exportToExcel, exportToPdf } from '../../../utils/exportUtils';
import { buildPrintRecordsTableHtml } from '../../../utils/printTableHtml';
import { openPrintWindow } from '../../../utils/printUtils';
import { formatSalesForExport } from '../../../utils/importTemplates';
import { hasPermission, PERMISSIONS } from '../../../constants/permissions';
import { buildActiveCancelledStatusMap } from '../../../constants/badgeMaps';
import { salesKeys, companyKeys } from '../../../services/queryKeys';
import { addCalendarDaysYmd } from '../dailySalesScreenUtils';
import type { DailySalesChannelEntry } from '../components/DailySalesChannelsChips';
import type { SalesListShiftFilter, SalesShiftValue } from '../constants/salesShift';
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
  summaries: DailySalesSummary[];
  summaryNumbersText: string;
  shiftsText: string;
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
  } = useApiQuery<{ total?: number; items?: DailySalesSummary[] }>({
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

  const salesPageData = salesPage as { total?: number; items?: DailySalesSummary[] } | undefined;
  const listTotal = salesPageData?.total ?? 0;
  const pagedSummaries = salesPageData?.items ?? [];

  const { data: companyData } = useApiQuery<any>({
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

  const openWhatsApp = useCallback(async (s: DailySalesSummary) => {
    const group = (s as DailySalesTableRow).summaries;
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
      const editingRow = editingSummary as DailySalesTableRow;
      const targetId = editingRow.summaries?.length === 1 ? editingRow.summaries[0].id : editingSummary.id;
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

  const handleDeleteSummary = useCallback((s: DailySalesSummary) => {
    if (!companyId) return;
    const summaries = (s as DailySalesTableRow).summaries?.length ? (s as DailySalesTableRow).summaries : [s];
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

  const tableData = useMemo((): DailySalesTableRow[] => {
    const groups = new Map<string, DailySalesSummary[]>();
    for (const s of pagedSummaries) {
      const key = toYmd(s.transactionDate || '');
      const list = groups.get(key) || [];
      list.push(s);
      groups.set(key, list);
    }
    const shiftOrder: Record<SalesShiftValue, number> = { morning: 1, evening: 2, all: 3 };
    return Array.from(groups.entries()).map(([dateKey, summaries]) => {
      const ordered = [...summaries].sort((a, b) => shiftOrder[resolveSalesSummaryShift(a)] - shiftOrder[resolveSalesSummaryShift(b)]);
      const primary = ordered[0] as DailySalesSummary;
      const total = ordered.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
      const cc = ordered.reduce((sum, s) => sum + (Number(s.customerCount) || 0), 0);
      const cashOnHand = ordered.reduce((sum, s) => sum + Number(s.cashOnHand || 0), 0);
      const channelsByVault = new Map<string, DailySalesChannelEntry>();
      for (const s of ordered) {
        for (const ch of s.channels || []) {
          const vault = ch.vault ?? (ch.vaultId ? vaultById.get(ch.vaultId) ?? null : null);
          const vaultKey = ch.vaultId ?? ch.vault?.id ?? `n:${vaultDisplayName(vault, lang)}`;
          const current = channelsByVault.get(vaultKey);
          channelsByVault.set(vaultKey, {
            ...ch,
            ...(ch.vaultId || ch.vault?.id ? { vaultId: vaultKey } : {}),
            amount: Number(current?.amount || 0) + Number(ch.amount || 0),
            vault: vault || current?.vault,
          });
        }
      }
      const channels = Array.from(channelsByVault.values());
      const channelsText = channels.map((ch) => `${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount)}`).join(' | ');
      const shiftsText = ordered.map((s) => getSalesShiftLabel(resolveSalesSummaryShift(s), t)).join(' / ');
      const summaryNumbersText = ordered.map((s) => s.summaryNumber).filter(Boolean).join(' / ');
      const hasCancelled = ordered.some((s) => s.status === 'cancelled');
      const allCancelled = ordered.every((s) => s.status === 'cancelled');
      return {
        ...primary,
        id: `day-${dateKey}`,
        summaryNumber: summaryNumbersText || primary.summaryNumber,
        summaryNumbersText,
        transactionDate: dateKey,
        shift: ordered.length === 1 ? resolveSalesSummaryShift(primary) : 'all',
        shiftsText,
        channels,
        channelsText,
        customerCount: cc,
        cashOnHand,
        totalAmount: total,
        avgPerCustomer: cc > 0 ? total / cc : 0,
        status: allCancelled ? 'cancelled' : hasCancelled ? 'active' : primary.status,
        summaries: ordered,
      };
    });
  }, [pagedSummaries, lang, t]);

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
        shiftLabel: getSalesShiftLabel(resolveSalesSummaryShift(s), t),
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
    const printRows = allFilteredData.map((s) => {
      const ch = (s.channels || []).map((c) => `${vaultDisplayName(c.vault, lang)}: ${fmt(c.amount)}`).join(' | ');
      const total = Number(s.totalAmount || 0);
      const cc = s.customerCount || 0;
      return {
        [t('summaryNumber')]: String(s.summaryNumber ?? ''),
        [t('transactionDate')]: formatSaudiDate(s.transactionDate),
        [t('salesShiftLabel')]: getSalesShiftLabel(resolveSalesSummaryShift(s), t),
        [t('salesChannels')]: ch || '—',
        [t('customers')]: cc,
        [t('total')]: fmt(total),
        [t('avgPerOrder')]: cc > 0 ? fmt(total / cc) : '0.00',
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
