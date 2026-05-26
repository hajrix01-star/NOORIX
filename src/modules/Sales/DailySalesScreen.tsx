/**
 * DailySalesScreen — ملخص المبيعات اليومي
 * يعتمد على: useSales, useVaults (hooks) + SmartTable + utils/saudiDate, utils/format
 * يدعم: تصدير Excel، PDF، طباعة احترافية (اسم الشركة + شعار)
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useSales } from '../../hooks/useSales';
import { useSalesChannels } from '../../hooks/useSalesChannels';
import { getCompany, getDailySalesSummaries, fetchAllSalesSummariesForExport, throwIfApiFailed } from '../../services/api';
import { formatSaudiDate, formatSaudiWeekdayName, getSaudiToday, toDateInputYmd, toYmd } from '../../utils/saudiDate';
import { fmt, sumAmounts } from '../../utils/format';
import { vaultDisplayName } from '../../utils/vaultDisplay';
import { exportToExcel, exportToPdf } from '../../utils/exportUtils';
import { openPrintWindow } from '../../utils/printUtils';
import { Badge, Button, ScreenShell, FmtNum, cn, KebabMenu, SmartTable } from '../../ui';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
import { SalesActionsCell } from '../../components/common/SalesActionsCell';
import { SalesEditModal } from './components/SalesEditModal';
import { SalesEntryModal } from './components/SalesEntryModal';
import ImportExportModal from '../../components/ImportExportModal';
import { formatSalesForExport } from '../../utils/importTemplates';
import { hasPermission, PERMISSIONS } from '../../constants/permissions';
import { buildActiveCancelledStatusMap } from '../../constants/badgeMaps';
import { salesKeys, companyKeys } from '../../services/queryKeys';

const PAGE_SIZE = 50;
type SalesShiftFilter = 'morning' | 'evening' | 'all';

function getSalesShiftLabel(shift: SalesShiftFilter, t: (k: string) => string): string {
  if (shift === 'morning') return t('salesShiftMorning');
  if (shift === 'evening') return t('salesShiftEvening');
  return t('salesShiftAll');
}

/** عرض قنوات البيع في الجدول والجوال — شرائح واضحة بدل نص مفصول بـ | */
function SalesChannelsChips({ channels, lang }: any) {
  const list = Array.isArray(channels)
    ? [...channels].sort(
        (a: any, b: any) =>
          (a.vault?.sortOrder ?? 0) - (b.vault?.sortOrder ?? 0) ||
          String(a.vault?.nameAr || '').localeCompare(String(b.vault?.nameAr || ''), 'ar'),
      )
    : [];
  if (list.length === 0) {
    return <span className="text-[12px] text-noorix-muted">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 justify-end">
      {list.map((ch: any, i: any) => {
        const vid = ch.vaultId ?? ch.vault?.id ?? i;
        const label = vaultDisplayName(ch.vault, lang);
        return (
          <div
            key={vid}
            className={cn(
              'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-noorix-border',
              'bg-noorix-bg-muted/90 px-2 py-1 shadow-sm',
            )}
            title={label}
          >
            <span className="min-w-0 truncate text-[11px] font-semibold text-noorix-text">{label}</span>
            <span dir="ltr" className="shrink-0 whitespace-nowrap text-[12px] font-bold tabular-nums text-nx-sales">
              {fmt(ch.amount)} <span className="nx-sar">SR</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function addCalendarDaysYmd(ymd: any, delta: any) {
  const [y, m, d] = ymd.split('-').map((x: any) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  if (isNaN(dt.getTime())) return ymd;
  return toDateInputYmd(dt) || ymd;
}

/* ══ الشاشة الرئيسية ══════════════════════════════════════════ */
export default function DailySalesScreen() {
  const queryClient = useQueryClient();
  const { activeCompanyId, userRole, userPermissions, companies } = useApp();
  const { t, lang } = useTranslation();
  const [searchParams] = useSearchParams();
  const urlDrillKeyRef = useRef('');
  const companyId = activeCompanyId ?? '';
  const dateFilter = useDateFilter();
  const activeCo = companies?.find((c: any) => c.id === activeCompanyId);
  const companyName = (lang === 'en' ? (activeCo?.nameEn || activeCo?.nameAr) : (activeCo?.nameAr || activeCo?.nameEn)) || '';
  const logoUrl = activeCo?.logoUrl || '';

  // ── كل الـ Hooks في أعلى المكوّن ──
  const { showToast } = useToast();
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingSummary, setEditingSummary] = useState<any>(null);
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
  const [selectedShift, setSelectedShift] = useState<SalesShiftFilter>('all');

  const salesFullHistory = hasPermission(userRole, PERMISSIONS.SALES_FULL_HISTORY, userPermissions);
  const salesViewSummariesList = hasPermission(userRole, PERMISSIONS.SALES_VIEW_SUMMARIES_LIST, userPermissions);

  const { createSummary, updateSummary, deleteSummary } = useSales({
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
    setSelectedShift('all');
  }, [companyId]);

  useEffect(() => {
    if (!salesFullHistory) return;
    const keys = ['from', 'to', 'q'];
    const parts = keys.map((k: any) => searchParams.get(k) || '');
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

  const listTotal = salesPage?.total ?? 0;
  const pagedSummaries = salesPage?.items ?? [];

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
  const salesShiftsEnabled = !!companyData?.salesShiftsEnabled;

  useEffect(() => {
    if (!salesShiftsEnabled && selectedShift !== 'all') {
      setSelectedShift('all');
    }
  }, [salesShiftsEnabled, selectedShift]);

  // ── حسابات ──
  function buildWhatsAppText(s: any) {
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
      `${t('salesWhatsAppReportTitle')}${name ? ` ${name}` : ''}`,
      `${t('salesWhatsAppDateLine')} ${dateWithWeekday}`,
      `${t('salesWhatsAppSummaryRef')} ${s.summaryNumber ?? '—'}`,
      `${t('salesWhatsAppShiftLine')} ${getSalesShiftLabel((s.shift || 'all') as SalesShiftFilter, t)}`,
      '',
    ];

    const chList = s.channels || [];
    if (chList.length > 0) {
      chList.forEach((ch: any) => {
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
  }

  function openWhatsApp(s: any) {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildWhatsAppText(s))}`, '_blank');
  }

  async function handleEditSave(body: any) {
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

  const handleDeleteSummary = useCallback((s: any) => {
    if (!companyId || !window.confirm(t('deleteSummaryConfirm', s.summaryNumber))) return;
    deleteSummary.mutate(
      { id: s.id, companyId },
      {
        onSuccess: () => showToast(t('summaryDeleted'), 'success'),
        onError: (e: any) => showToast(e?.message || t('deleteFailed'), 'error'),
      },
    );
  }, [companyId, deleteSummary, t, showToast]);

  const hasCompany = !!companyId;

  // ── بيانات الجدول ──
  const STATUS_MAP = useMemo(() => buildActiveCancelledStatusMap(t), [t]);

  const tableData = useMemo(() => pagedSummaries.map((s: any) => {
    const total = Number(s.totalAmount || 0);
    const cc = s.customerCount || 0;
    const channelsText = (s.channels || []).map((ch: any) => `${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount)}`).join(' | ');
    return {
      ...s,
      shift: (s.shift || 'all') as SalesShiftFilter,
      channelsText,
      avgPerCustomer: cc > 0 ? total / cc : 0,
    };
  }), [pagedSummaries, lang]);

  const allowedSort = useMemo(() => new Set(['summaryNumber', 'transactionDate', 'totalAmount', 'customerCount']), []);
  const toggleSort = useCallback((key: any) => {
    if (!allowedSort.has(key)) return;
    setSortKey((prev: any) => {
      if (prev === key) {
        setSortDir((d: any) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('desc');
      return key;
    });
    setListPage(1);
  }, [allowedSort]);

  const activeOnly = tableData.filter((s: any) => s.status !== 'cancelled');
  const displayedTotal = listTotal;
  const totalAmountSum = sumAmounts(activeOnly, 'totalAmount');
  const totalCustomers = activeOnly.reduce((sum: any, s: any) => sum + (s.customerCount || 0), 0);

  const columns = useMemo(() => [
    { key: 'summaryNumber', label: t('summaryNumber'), sortable: true, width: '10%',
      render: (v: any) => <span className="nx-cell-num nx-cell-accent">{v}</span> },
    { key: 'transactionDate', label: t('transactionDate'), sortable: true, width: '10%',
      render: (v: any, row: any) => (
        <div className="flex flex-col items-start gap-0.5">
          <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span>
          {(salesShiftsEnabled || row.shift !== 'all') ? (
            <span className="inline-flex items-center rounded-md bg-noorix-bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-noorix-muted">
              {getSalesShiftLabel((row.shift || 'all') as SalesShiftFilter, t)}
            </span>
          ) : null}
        </div>
      ) },
    { key: 'channelsText', label: t('salesChannels'), sortable: false, width: '38%',
      render: (_: any, row: any) => <SalesChannelsChips channels={row.channels} lang={lang} /> },
    { key: 'customerCount', label: t('customers'), numeric: true, sortable: true, width: '7%',
      render: (v: any) => <span className="nx-cell-num nx-cell-num--blue">{v ?? 0}</span> },
    { key: 'totalAmount', label: t('total'), numeric: true, sortable: true, width: '10%',
      render: (v: any) => <FmtNum n={v} className="nx-cell-num nx-cell-num--green nx-cell-bold" /> },
    { key: 'avgPerCustomer', label: t('avgPerOrder'), numeric: true, sortable: false, width: '7%',
      render: (v: any) => <FmtNum n={v} className="nx-cell-num nx-cell-num--violet" /> },
    { key: 'status', label: t('statusLabel'), width: '8%',
      render: (v: any) => <Badge {...Badge.fromStatus(v, STATUS_MAP)} size="sm" /> },
    { key: 'actions', label: t('actions'), align: 'center', width: '8%',
      render: (_: any, row: any) => (
        <SalesActionsCell
          summary={row}
          userRole={userRole}
          onPrint={openWhatsApp}
          onEdit={setEditingSummary}
          onDelete={handleDeleteSummary}
        />
      ),
    },
  ], [userRole, t, STATUS_MAP, handleDeleteSummary, lang, salesShiftsEnabled]);

  const footerCells = (
    <>
      <td />
      <td colSpan={3} className="nx-tfoot-label">
        {t('totalSummaries', activeOnly.length)}
        {listTotal > PAGE_SIZE ? (
          <span className="nx-cell-muted-sm me-1.5"> (إجمالي الصفحة الحالية)</span>
        ) : null}
      </td>
      <td className="nx-tfoot-num nx-cell-num--blue">{totalCustomers.toLocaleString('en')}</td>
      <td className="nx-tfoot-num nx-cell-num--green"><FmtNum n={totalAmountSum.toNumber()} /></td>
      <td className="nx-tfoot-num nx-cell-num--violet">{totalCustomers > 0 ? <FmtNum n={totalAmountSum.toNumber() / totalCustomers} /> : '0.00'}</td>
      <td colSpan={2} />
    </>
  );

  // ── بيانات التصدير والطباعة (تُصدّر البيانات المعروضة/المفلترة) ──
  const exportColumns = [
    { key: 'summaryNumber', label: t('summaryNumber') },
    { key: 'transactionDate', label: t('transactionDate') },
    { key: 'shiftLabel', label: t('salesShiftLabel') },
    { key: 'channelsText', label: t('salesChannels') },
    { key: 'customerCount', label: t('customers') },
    { key: 'totalAmount', label: t('total') },
    { key: 'avgPerCustomer', label: t('avgPerOrder') },
    { key: 'status', label: t('statusLabel') },
  ];

  function mapSummariesToExportRows(rows: any) {
    return rows.map((s: any) => {
      const total = Number(s.totalAmount || 0);
      const cc = s.customerCount || 0;
      const channelsText = (s.channels || []).map((ch: any) => `${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount)}`).join(' | ');
      return {
        summaryNumber: s.summaryNumber,
        transactionDate: formatSaudiDate(s.transactionDate),
        shiftLabel: getSalesShiftLabel((s.shift || 'all') as SalesShiftFilter, t),
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
      const exportData = mapSummariesToExportRows(all);
      exportToExcel({
        columns: exportColumns,
        data: exportData,
        filename: `sales-summaries-${dateFilter.startDate || 'all'}-${dateFilter.endDate || 'all'}.xlsx`,
        companyName,
        title: `${t('salesDailySummary')} — ${dateFilter.label}`,
        logoUrl,
      });
    } catch (e: any) {
      showToast(e?.message || t('saveFailed'), 'error');
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
    } catch (e: any) {
      showToast(e?.message || t('saveFailed'), 'error');
    } finally {
      setExportBusy(false);
    }
  }

  async function handlePrint() {
    if (!companyId) return;
    setExportBusy(true);
    let allFilteredData = [];
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
    } catch (e: any) {
      showToast(e?.message || t('saveFailed'), 'error');
      setExportBusy(false);
      return;
    } finally {
      setExportBusy(false);
    }
    const channelsRows = allFilteredData.map((s: any) => {
      const ch = (s.channels || []).map((c: any) => `${vaultDisplayName(c.vault, lang)}: ${fmt(c.amount)}`).join(' | ');
      const total = Number(s.totalAmount || 0);
      const cc = s.customerCount || 0;
      const shiftLabel = getSalesShiftLabel((s.shift || 'all') as SalesShiftFilter, t);
      return `<tr><td>${(s.summaryNumber || '').replace(/</g, '&lt;')}</td><td>${formatSaudiDate(s.transactionDate)}</td><td>${shiftLabel}</td><td>${(ch || '—').replace(/</g, '&lt;')}</td><td>${cc}</td><td>${fmt(total)}</td><td>${cc > 0 ? fmt(total / cc) : '0.00'}</td><td>${s.status === 'cancelled' ? t('statusCancelled') : t('statusActive')}</td></tr>`;
    }).join('');
    openPrintWindow({
      title: t('salesDailySummary'),
      companyName: companyName || 'الشركة',
      subtitle: `${t('salesDailySummary')} — ${dateFilter.label || ''}`,
      logoUrl: logoUrl || '',
      body: `<table><thead><tr><th>${t('summaryNumber')}</th><th>${t('transactionDate')}</th><th>${t('salesShiftLabel')}</th><th>${t('salesChannels')}</th><th>${t('customers')}</th><th>${t('total')}</th><th>${t('avgPerOrder')}</th><th>${t('statusLabel')}</th></tr></thead><tbody>${channelsRows || '<tr><td colspan="8">' + t('noSummariesInPeriod') + '</td></tr>'}</tbody></table>`,
    });
  }

  const renderMobileCard = useCallback((row: any) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold text-noorix-blue ltr">#{row.summaryNumber}</span>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-noorix-muted">{formatSaudiDate(row.transactionDate)}</span>
          {(salesShiftsEnabled || row.shift !== 'all') && (
            <span className="rounded-md bg-noorix-bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-noorix-muted">
              {getSalesShiftLabel((row.shift || 'all') as SalesShiftFilter, t)}
            </span>
          )}
          <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} size="sm" />
        </div>
      </div>
      <div className="rounded-lg border border-noorix-border/80 bg-noorix-bg-muted/40 p-2">
        <div className="text-[11px] font-bold text-noorix-muted mb-1.5">{t('salesChannels')}</div>
        <SalesChannelsChips channels={row.channels} lang={lang} />
      </div>
      <div className="nx-mc__grid nx-mc__grid--3 mt-1">
        <div>
          <div className="nx-mc__stat-label">{t('total')}</div>
          <div className="nx-mc__stat-value text-[13px] font-bold text-noorix-green"><FmtNum n={row.totalAmount} /></div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('customers')}</div>
          <div className="nx-mc__stat-value text-[13px] font-bold text-noorix-blue">{row.customerCount ?? 0}</div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('avgPerOrder')}</div>
          <div className="nx-mc__stat-value text-[13px] font-bold text-noorix-violet"><FmtNum n={row.avgPerCustomer} /></div>
        </div>
      </div>
      <div className="flex justify-end mt-1">
        <SalesActionsCell summary={row} userRole={userRole} onPrint={openWhatsApp} onEdit={setEditingSummary} onDelete={handleDeleteSummary} />
      </div>
    </div>
  ), [STATUS_MAP, userRole, t, handleDeleteSummary, lang, salesShiftsEnabled]);

  const renderCompactRow = useCallback((row: any) => (
    <div onClick={() => setEditingSummary(row)} style={{ cursor: 'pointer' }}>
      <div className="nx-cr__line1">
        <span className="nx-cr__id">#{row.summaryNumber}</span>
        <span className="nx-cr__meta">{formatSaudiDate(row.transactionDate)}</span>
        {(salesShiftsEnabled || row.shift !== 'all') && (
          <span className="nx-cr__meta">{getSalesShiftLabel((row.shift || 'all') as SalesShiftFilter, t)}</span>
        )}
        <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} size="sm" />
      </div>
      <div className="nx-cr__line2">
        <div className="nx-cr__line2-start">
          <span className="nx-cr__meta">{row.customerCount ?? 0} {t('customers')}</span>
        </div>
        <div className="nx-cr__line2-end">
          <span className="nx-cr__amount text-noorix-green"><FmtNum n={row.totalAmount} /> <span className="nx-sar">SR</span></span>
          <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
            <KebabMenu
              ariaLabel={t('actions')}
              items={[
                { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => setEditingSummary(row) },
                ...(row.status !== 'cancelled' ? [{ key: 'delete', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => handleDeleteSummary(row) }] : []),
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  ), [STATUS_MAP, t, handleDeleteSummary, setEditingSummary, salesShiftsEnabled]);

  return (
    <ScreenShell>
      {editingSummary && (
        <SalesEditModal
          summary={editingSummary}
          salesChannels={salesChannels}
          salesChannelsLoading={salesChannelsLoading}
          salesChannelsError={salesChannelsHasError ? (salesChannelsError?.message || t('salesChannelsLoadFailed')) : ''}
          companyId={companyId}
          vatEnabled={vatEnabled}
          vatRate={vatRate}
          shiftsEnabled={salesShiftsEnabled}
          onSaved={handleEditSave}
          onClose={() => setEditingSummary(null)}
        />
      )}

      {showEntryModal && hasCompany && (
        <SalesEntryModal
          companyId={companyId}
          salesChannels={salesChannels}
          salesChannelsLoading={salesChannelsLoading}
          salesChannelsError={salesChannelsHasError ? (salesChannelsError?.message || t('salesChannelsLoadFailed')) : ''}
          vatEnabled={vatEnabled}
          vatRate={vatRate}
          shiftsEnabled={salesShiftsEnabled}
          createSummary={createSummary}
          onSuccess={(summary: any) => showToast(`${t('summarySaved')} — ${t('summaryNumber')}: ${summary?.summaryNumber || ''}`, 'success')}
          onError={(msg: any) => showToast(msg || t('saveFailed'), 'error')}
          onClose={() => setShowEntryModal(false)}
          onWhatsApp={openWhatsApp}
          autoCloseOnSuccess={false}
        />
      )}

      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        entityType="sales"
        companyId={companyId}
        exportFetcher={async () => {
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
        }}
        onImportSuccess={() => {
          invalidateOnFinancialMutation(queryClient);
          showToast('تم استيراد ملخصات المبيعات بنجاح', 'success');
        }}
      />

      {/* هيدر + شريط إجراءات — زر الملخصات الملغاة هنا ليظهر فوق الطيّ ولا يختفي داخل رأس الجدول */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('salesDailySummary')}</h1>
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {hasCompany && salesViewSummariesList && salesShiftsEnabled && (
            <div className="inline-flex items-center gap-1 rounded-lg border border-noorix-border bg-noorix-bg-muted/50 p-1">
              <span className="text-[12px] font-semibold text-noorix-muted px-1">{t('salesShiftFilter')}</span>
              <Button size="sm" variant={selectedShift === 'all' ? 'primary' : 'ghost'} onClick={() => setSelectedShift('all')}>
                {t('salesShiftAll')}
              </Button>
              <Button size="sm" variant={selectedShift === 'morning' ? 'primary' : 'ghost'} onClick={() => setSelectedShift('morning')}>
                {t('salesShiftMorning')}
              </Button>
              <Button size="sm" variant={selectedShift === 'evening' ? 'primary' : 'ghost'} onClick={() => setSelectedShift('evening')}>
                {t('salesShiftEvening')}
              </Button>
            </div>
          )}
          {hasCompany && salesViewSummariesList && (
            <Button
              size="sm"
              variant={showCancelledSales ? 'primary' : 'default'}
              aria-pressed={showCancelledSales}
              onClick={() => setShowCancelledSales((v: any) => !v)}
            >
              {showCancelledSales ? t('hideCancelledSummaries') : t('showCancelledSummaries')}
            </Button>
          )}
          {salesFullHistory && (
            <Button
              size="sm"
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
              onClick={() => setShowImportExport(true)}
              disabled={!hasCompany}
            >
              استيراد / تصدير
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setShowEntryModal(true)} disabled={!hasCompany}>
            {t('addDailySummary')}
          </Button>
        </div>
      </div>

      {hasCompany && salesChannelsHasError && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-noorix-red">
          <span className="flex-1">{salesChannelsError?.message || t('salesChannelsLoadFailed')}</span>
          <Button size="sm" onClick={() => void refetchSalesChannels()}>{t('retryLoadSalesChannels')}</Button>
        </div>
      )}

      {salesFullHistory && <DateFilterBar filter={dateFilter} />}

      {!hasCompany && (
        <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[14px]">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {hasCompany && !salesViewSummariesList && (
        <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[14px]">
          {t('salesSummariesHiddenByRole')}
        </div>
      )}
      {hasCompany && salesViewSummariesList && (
        <SmartTable
          columns={columns}
          data={tableData}
          total={displayedTotal}
          page={listPage}
          pageSize={PAGE_SIZE}
          onPageChange={setListPage}
          isLoading={summariesLoading}
          isError={!!summariesError}
          errorMessage={summariesError?.message || ''}
          footerCells={footerCells}
          title={t('previousSummaries')}
          showRowNumbers
          rowNumberWidth="1%"
          badge={
            <>
              <span className="text-[12px] text-noorix-muted">— {dateFilter.label}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-noorix-blue text-[12px] font-semibold">
                {t('summaryCount', displayedTotal)}
              </span>
              {salesFullHistory && (
                <span className="flex flex-wrap gap-1.5 print:hidden">
                  <Button size="sm" onClick={handleExportExcel} disabled={displayedTotal === 0 || exportBusy}>{exportBusy ? '…' : t('exportExcel')}</Button>
                  <Button size="sm" onClick={handleExportPdf} disabled={displayedTotal === 0 || exportBusy}>{exportBusy ? '…' : 'طباعة / PDF'}</Button>
                  <Button size="sm" onClick={handlePrint} disabled={displayedTotal === 0 || exportBusy}>{exportBusy ? '…' : t('print')}</Button>
                </span>
              )}
            </>
          }
          searchValue={salesFullHistory ? searchInput : undefined}
          onSearchChange={salesFullHistory ? setSearchInput : undefined}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          emptyMessage={t('noSummariesInPeriod')}
          renderCompactRow={renderCompactRow}
          renderMobileCard={renderMobileCard}
        />
      )}
    </ScreenShell>
  );
}
