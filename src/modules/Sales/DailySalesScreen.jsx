/**
 * DailySalesScreen — ملخص المبيعات اليومي
 * يعتمد على: useSales, useVaults (hooks) + SmartTable + utils/saudiDate, utils/format
 * يدعم: تصدير Excel، PDF، طباعة احترافية (اسم الشركة + شعار)
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useSales } from '../../hooks/useSales';
import { useSalesChannels } from '../../hooks/useSalesChannels';
import { getCompany, getDailySalesSummaries, fetchAllSalesSummariesForExport } from '../../services/api';
import { formatSaudiDate, getSaudiToday } from '../../utils/saudiDate';
import { fmt, sumAmounts } from '../../utils/format';
import { vaultDisplayName } from '../../utils/vaultDisplay';
import { exportToExcel, exportToPdf } from '../../utils/exportUtils';
import { Badge, Button } from '../../ui';
import Toast from '../../components/Toast';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
import SmartTable from '../../components/common/SmartTable';
import { SalesActionsCell } from '../../components/common/SalesActionsCell';
import { SalesEditModal } from './components/SalesEditModal';
import { SalesEntryModal } from './components/SalesEntryModal';
import ImportExportModal from '../../components/ImportExportModal';
import { formatSalesForExport } from '../../utils/importTemplates';
import { hasPermission, PERMISSIONS } from '../../constants/permissions';

const PAGE_SIZE = 50;

function addCalendarDaysYmd(ymd, delta) {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
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
  const companyName = companies?.find((c) => c.id === activeCompanyId)?.nameAr || '';
  const logoUrl = companies?.find((c) => c.id === activeCompanyId)?.logoUrl || '';

  // ── كل الـ Hooks في أعلى المكوّن ──
  const [toast, setToast]             = useState({ visible: false, message: '', type: 'success' });
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingSummary, setEditingSummary] = useState(null);
  const [listPage, setListPage] = useState(1);
  const qInit = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('q') || '') : '';
  const [searchInput, setSearchInput] = useState(qInit);
  const [debouncedQ, setDebouncedQ] = useState(qInit.trim());
  const [sortKey, setSortKey] = useState('transactionDate');
  const [sortDir, setSortDir] = useState('desc');
  const [exportBusy, setExportBusy] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);

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
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (salesFullHistory) return;
    setSearchInput('');
    setDebouncedQ('');
  }, [salesFullHistory, companyId]);

  useEffect(() => {
    if (salesFullHistory || !companyId) return;
    const end = getSaudiToday();
    const start = addCalendarDaysYmd(end, -6);
    dateFilter.setMode('range');
    dateFilter.setRangeStart(start);
    dateFilter.setRangeEnd(end);
  }, [salesFullHistory, companyId]);

  const debouncedQEffective = salesFullHistory ? debouncedQ : '';

  useEffect(() => {
    setListPage(1);
  }, [debouncedQEffective, dateFilter.startDate, dateFilter.endDate]);

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
      dateFilter.setRangeStart(from.slice(0, 10));
      dateFilter.setRangeEnd(to.slice(0, 10));
    }
    if (q) {
      setSearchInput(q);
      setDebouncedQ(q.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const {
    data: salesPage,
    isLoading: summariesLoading,
    error: summariesError,
  } = useQuery({
    queryKey: [
      'sales-summaries-paged',
      companyId,
      dateFilter.startDate,
      dateFilter.endDate,
      listPage,
      PAGE_SIZE,
      debouncedQEffective,
      sortKey,
      sortDir,
      salesViewSummariesList,
    ],
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
        true,
      );
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل المبيعات');
      return res.data;
    },
    enabled: !!companyId && salesViewSummariesList,
  });

  const listTotal = salesPage?.total ?? 0;
  const pagedSummaries = salesPage?.items ?? [];

  const { data: companyData } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      const res = await getCompany(companyId);
      return res?.success ? res.data : null;
    },
    enabled: !!companyId,
  });
  const vatEnabled = !!companyData?.vatEnabledForSales;
  const vatRate = companyData?.vatRatePercent != null ? Number(companyData.vatRatePercent) / 100 : 0.15;

  // ── حسابات ──
  function buildWhatsAppText(s) {
    const cc = s.customerCount || 0;
    const total = Number(s.totalAmount || 0);
    const avg = cc > 0 ? (total / cc) : 0;
    const channels = (s.channels || []).map((ch) => `  • ${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount, 2)} ﷼`).join('\n');
    return [
      `*ملخص المبيعات اليومي*`,
      `الرقم: ${s.summaryNumber}`,
      `التاريخ: ${formatSaudiDate(s.transactionDate)}`,
      ``,
      `عدد العملاء: ${cc}`,
      `إجمالي المبيعات: ${fmt(total, 2)} ﷼`,
      `معدل الطلب لكل عميل: ${fmt(avg, 2)} ﷼`,
      Number(s.cashOnHand) > 0 ? `المبلغ الموجود بالصندوق: ${fmt(s.cashOnHand, 2)} ﷼` : '',
      ``, `*تفاصيل القنوات:*`, channels,
      s.notes ? `\nملاحظات: ${s.notes}` : '',
      ``, `— Noorix ERP`,
    ].filter(Boolean).join('\n');
  }

  function openWhatsApp(s) {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildWhatsAppText(s))}`, '_blank');
  }

  async function handleEditSave(body) {
    if (!editingSummary || !companyId) return;
    const res = await updateSummary.mutateAsync({
      id: editingSummary.id,
      body,
      companyId,
    });
    if (res?.success === false) {
      throw new Error(res?.error || t('updateFailed'));
    }
    setToast({ visible: true, message: t('updateSuccess'), type: 'success' });
    setEditingSummary(null);
  }

  function handleDeleteSummary(s) {
    if (!companyId || !window.confirm(t('deleteSummaryConfirm', s.summaryNumber))) return;
    deleteSummary.mutate(
      { id: s.id, companyId },
      {
        onSuccess: () => setToast({ visible: true, message: t('summaryDeleted'), type: 'success' }),
        onError: (e) => setToast({ visible: true, message: e?.message || t('deleteFailed'), type: 'error' }),
      },
    );
  }

  const hasCompany = !!companyId;

  // ── بيانات الجدول ──
  const STATUS_MAP = useMemo(() => ({
    active:    { color: 'green', label: t('statusActive')    },
    cancelled: { color: 'red',   label: t('statusCancelled') },
  }), [t]);

  const tableData = useMemo(() => pagedSummaries.map((s) => {
    const total = Number(s.totalAmount || 0);
    const cc = s.customerCount || 0;
    const channelsText = (s.channels || []).map((ch) => `${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount, 2)}`).join(' | ');
    return {
      ...s,
      channelsText,
      avgPerCustomer: cc > 0 ? total / cc : 0,
    };
  }), [pagedSummaries, lang]);

  const allowedSort = useMemo(() => new Set(['summaryNumber', 'transactionDate', 'totalAmount', 'customerCount']), []);
  const toggleSort = useCallback((key) => {
    if (!allowedSort.has(key)) return;
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('desc');
      return key;
    });
    setListPage(1);
  }, [allowedSort]);

  const activeOnly = tableData.filter((s) => s.status !== 'cancelled');
  const displayedTotal = listTotal;
  const totalAmountSum = sumAmounts(activeOnly, 'totalAmount');
  const totalCustomers = activeOnly.reduce((sum, s) => sum + (s.customerCount || 0), 0);

  const columns = useMemo(() => [
    { key: 'summaryNumber', label: t('summaryNumber'), sortable: true, width: '10%',
      render: (v) => <span className="nx-cell-num nx-cell-accent">{v}</span> },
    { key: 'transactionDate', label: t('transactionDate'), sortable: true, width: '10%',
      render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
    { key: 'channelsText', label: t('salesChannels'), sortable: false, width: '35%',
      render: (v) => <span className="nx-cell-ellipsis" title={v || ''}>{v || '—'}</span> },
    { key: 'customerCount', label: t('customers'), numeric: true, sortable: true, width: '7%',
      render: (v) => <span className="nx-cell-num nx-cell-num--blue">{v ?? 0}</span> },
    { key: 'totalAmount', label: t('total'), numeric: true, sortable: true, width: '10%',
      render: (v) => <span className="nx-cell-num nx-cell-num--green nx-cell-bold">{fmt(v, 2)}</span> },
    { key: 'avgPerCustomer', label: t('avgPerOrder'), numeric: true, sortable: false, width: '7%',
      render: (v) => <span className="nx-cell-num nx-cell-num--violet">{fmt(v, 2)}</span> },
    { key: 'status', label: t('statusLabel'), width: '8%',
      render: (v) => <Badge {...Badge.fromStatus(v, STATUS_MAP)} size="sm" /> },
    { key: 'actions', label: t('actions'), align: 'center', width: '8%',
      render: (_, row) => (
        <SalesActionsCell
          summary={row}
          userRole={userRole}
          onPrint={openWhatsApp}
          onEdit={setEditingSummary}
          onDelete={handleDeleteSummary}
        />
      ),
    },
  ], [userRole, t, STATUS_MAP]);

  const footerCells = (
    <>
      <td />
      <td colSpan={3} className="nx-tfoot-label">
        {t('totalSummaries', activeOnly.length)}
        {listTotal > PAGE_SIZE ? (
          <span className="nx-cell-muted-sm" style={{ marginInlineEnd: 6 }}> (إجمالي الصفحة الحالية)</span>
        ) : null}
      </td>
      <td className="nx-tfoot-num nx-cell-num--blue">{totalCustomers.toLocaleString('en')}</td>
      <td className="nx-tfoot-num nx-cell-num--green">{fmt(totalAmountSum.toNumber(), 2)}</td>
      <td className="nx-tfoot-num nx-cell-num--violet">{totalCustomers > 0 ? fmt(totalAmountSum.toNumber() / totalCustomers, 2) : '0.00'}</td>
      <td colSpan={2} />
    </>
  );

  // ── بيانات التصدير والطباعة (تُصدّر البيانات المعروضة/المفلترة) ──
  const exportColumns = [
    { key: 'summaryNumber', label: t('summaryNumber') },
    { key: 'transactionDate', label: t('transactionDate') },
    { key: 'channelsText', label: t('salesChannels') },
    { key: 'customerCount', label: t('customers') },
    { key: 'totalAmount', label: t('total') },
    { key: 'avgPerCustomer', label: t('avgPerOrder') },
    { key: 'status', label: t('statusLabel') },
  ];

  function mapSummariesToExportRows(rows) {
    return rows.map((s) => {
      const total = Number(s.totalAmount || 0);
      const cc = s.customerCount || 0;
      const channelsText = (s.channels || []).map((ch) => `${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount, 2)}`).join(' | ');
      return {
        summaryNumber: s.summaryNumber,
        transactionDate: formatSaudiDate(s.transactionDate),
        channelsText,
        customerCount: cc,
        totalAmount: fmt(total, 2),
        avgPerCustomer: cc > 0 ? fmt(total / cc, 2) : '0.00',
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
        debouncedQ,
        sortKey,
        sortDir,
      );
      const exportData = mapSummariesToExportRows(all);
      exportToExcel({
        columns: exportColumns,
        data: exportData,
        filename: `sales-summaries-${dateFilter.startDate || 'all'}-${dateFilter.endDate || 'all'}`,
        companyName,
        title: `${t('salesDailySummary')} — ${dateFilter.label}`,
        logoUrl,
      });
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' });
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
        debouncedQ,
        sortKey,
        sortDir,
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
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' });
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
        debouncedQ,
        sortKey,
        sortDir,
      );
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' });
      setExportBusy(false);
      return;
    } finally {
      setExportBusy(false);
    }
    const channelsRows = allFilteredData.map((s) => {
      const ch = (s.channels || []).map((c) => `${vaultDisplayName(c.vault, lang)}: ${fmt(c.amount, 2)}`).join(' | ');
      const total = Number(s.totalAmount || 0);
      const cc = s.customerCount || 0;
      return `<tr><td>${(s.summaryNumber || '').replace(/</g, '&lt;')}</td><td>${formatSaudiDate(s.transactionDate)}</td><td>${(ch || '—').replace(/</g, '&lt;')}</td><td>${cc}</td><td>${fmt(total, 2)}</td><td>${cc > 0 ? fmt(total / cc, 2) : '0.00'}</td><td>${s.status === 'cancelled' ? t('statusCancelled') : t('statusActive')}</td></tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${(t('salesDailySummary') || '').replace(/</g, '&lt;')}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:24px;font-size:14px;color:#1a1a1a;line-height:1.6}.page{max-width:210mm;margin:0 auto}.header{text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px}.header img{max-height:48px}.header h1{margin:8px 0 4px;font-size:20px}.header .sub{font-size:12px;color:#555}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 12px;border:1px solid #ddd}th{background:#2563eb;color:#fff;font-weight:700}.no-print{display:none}@media print{body{padding:0}.no-print{display:none!important}}</style></head><body>
<div class="header">${logoUrl ? `<img src="${logoUrl}" alt="" />` : ''}<h1>${(companyName || 'الشركة').replace(/</g, '&lt;')}</h1><div class="sub">${(t('salesDailySummary') || '').replace(/</g, '&lt;')} — ${(dateFilter.label || '').replace(/</g, '&lt;')}</div></div>
<table><thead><tr><th>${t('summaryNumber')}</th><th>${t('transactionDate')}</th><th>${t('salesChannels')}</th><th>${t('customers')}</th><th>${t('total')}</th><th>${t('avgPerOrder')}</th><th>${t('statusLabel')}</th></tr></thead><tbody>${channelsRows || '<tr><td colspan="7">' + t('noSummariesInPeriod') + '</td></tr>'}</tbody></table>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onafterprint = () => { try { w.close(); } catch (_) {} };
      w.onload = () => setTimeout(() => w.print(), 300);
    }
  }

  const renderMobileCard = useCallback((row) => (
    <div>
      <div className="nx-mc__header">
        <span className="nx-cell-num nx-cell-accent" style={{ fontSize: 14 }}>
          #{row.summaryNumber}
        </span>
        <div className="nx-mc__meta">
          <span className="nx-cell-muted-sm">{formatSaudiDate(row.transactionDate)}</span>
          <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} size="sm" />
        </div>
      </div>
      {row.channelsText && (
        <div className="nx-mc__channels">{row.channelsText}</div>
      )}
      <div className="nx-mc__grid nx-mc__grid--3">
        <div>
          <div className="nx-mc__stat-label">{t('total')}</div>
          <div className="nx-mc__stat-value nx-cell-num--green">{fmt(row.totalAmount, 2)}</div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('customers')}</div>
          <div className="nx-mc__stat-value nx-cell-num--blue">{row.customerCount ?? 0}</div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('avgPerOrder')}</div>
          <div className="nx-mc__stat-value nx-cell-num--violet" style={{ fontSize: 13 }}>{fmt(row.avgPerCustomer, 2)}</div>
        </div>
      </div>
      <div className="nx-mc__actions">
        <SalesActionsCell summary={row} userRole={userRole} onPrint={openWhatsApp} onEdit={setEditingSummary} onDelete={handleDeleteSummary} />
      </div>
    </div>
  ), [STATUS_MAP, userRole, t]);

  return (
    <div className="nx-screen">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      {editingSummary && (
        <SalesEditModal
          summary={editingSummary}
          salesChannels={salesChannels}
          salesChannelsLoading={salesChannelsLoading}
          salesChannelsError={salesChannelsHasError ? (salesChannelsError?.message || t('salesChannelsLoadFailed')) : ''}
          companyId={companyId}
          vatEnabled={vatEnabled}
          vatRate={vatRate}
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
          createSummary={createSummary}
          onSuccess={(summary) => setToast({ visible: true, message: `${t('summarySaved')} — ${t('summaryNumber')}: ${summary?.summaryNumber || ''}`, type: 'success' })}
          onError={(msg) => setToast({ visible: true, message: msg || t('saveFailed'), type: 'error' })}
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
          const res = await fetchAllSalesSummariesForExport(companyId, dateFilter.startDate, dateFilter.endDate);
          const list = Array.isArray(res) ? res : (res?.items ?? []);
          return list.map(formatSalesForExport);
        }}
        onImportSuccess={() => {
          invalidateOnFinancialMutation(queryClient);
          setToast({ visible: true, message: 'تم استيراد ملخصات المبيعات بنجاح', type: 'success' });
        }}
      />

      {/* هيدر + شريط إجراءات (ثابت على الجوال بجانب الاستيراد) */}
      <div className="noorix-daily-sales-header">
        <div className="noorix-daily-sales-header__titles">
          <h1 className="nx-page-title">{t('salesDailySummary')}</h1>
        </div>
        <div className="noorix-daily-sales-header__toolbar noorix-print-hide">
          {salesFullHistory && (
            <Button
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
              onClick={() => setShowImportExport(true)}
              disabled={!hasCompany}
            >
              استيراد / تصدير
            </Button>
          )}
          <Button variant="primary" onClick={() => setShowEntryModal(true)} disabled={!hasCompany}>
            {t('addDailySummary')}
          </Button>
        </div>
      </div>

      {hasCompany && salesChannelsHasError && (
        <div className="nx-error-banner">
          {salesChannelsError?.message || t('salesChannelsLoadFailed')}
          <Button size="sm" onClick={refetchSalesChannels}>
            {t('retryLoadSalesChannels')}
          </Button>
        </div>
      )}

      {salesFullHistory && <DateFilterBar filter={dateFilter} />}

      {!hasCompany && (
        <div className="noorix-surface-card nx-empty-state">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {/* ── الملخصات السابقة — جدول احترافي ── */}
      {hasCompany && !salesViewSummariesList && (
        <div className="noorix-surface-card nx-empty-state">
          {t('salesSummariesHiddenByRole')}
        </div>
      )}
      {hasCompany && salesViewSummariesList && (
        <div className="noorix-sales-table-wrapper">
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
            innerPadding={16}
            badge={
            <>
              <span className="nx-cell-muted-sm">— {dateFilter.label}</span>
              <span className="nx-pill nx-pill--blue">{t('summaryCount', displayedTotal)}</span>
              {salesFullHistory && (
                <span className="noorix-print-hide" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Button size="sm" onClick={handleExportExcel} disabled={displayedTotal === 0 || exportBusy}>{exportBusy ? '…' : t('exportExcel')}</Button>
                  <Button size="sm" onClick={handleExportPdf} disabled={displayedTotal === 0 || exportBusy}>{exportBusy ? '…' : t('exportPdf')}</Button>
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
          renderMobileCard={renderMobileCard}
          />
        </div>
      )}
    </div>
  );
}
