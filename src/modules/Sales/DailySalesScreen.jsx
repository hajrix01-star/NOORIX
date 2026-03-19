/**
 * DailySalesScreen — ملخص المبيعات اليومي
 * يعتمد على: useSales, useVaults (hooks) + SmartTable + utils/saudiDate, utils/format
 * يدعم: تصدير Excel، PDF، طباعة احترافية (اسم الشركة + شعار)
 */
import React, { useState, useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useSales } from '../../hooks/useSales';
import { useVaults } from '../../hooks/useVaults';
import { getCompany } from '../../services/api';
import { useTableFilter } from '../../hooks/useTableFilter';
import { formatSaudiDate } from '../../utils/saudiDate';
import { fmt, sumAmounts } from '../../utils/format';
import { vaultDisplayName } from '../../utils/vaultDisplay';
import { exportToExcel, exportToPdf } from '../../utils/exportUtils';
import Toast from '../../components/Toast';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
import SmartTable from '../../components/common/SmartTable';
import { SalesActionsCell } from '../../components/common/SalesActionsCell';
import { SalesEditModal } from './components/SalesEditModal';
import { SalesEntryModal } from './components/SalesEntryModal';

const PAGE_SIZE = 50;

/* ── شارة الحالة ──────────────────────────────────────────────── */
const Badge = memo(function Badge({ map, value }) {
  const s = map[value] || { bg: 'rgba(100,116,139,0.08)', color: '#64748b', label: value };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
});

/* ══ الشاشة الرئيسية ══════════════════════════════════════════ */
export default function DailySalesScreen() {
  const { activeCompanyId, userRole, companies } = useApp();
  const { t, lang } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const dateFilter = useDateFilter();
  const companyName = companies?.find((c) => c.id === activeCompanyId)?.nameAr || '';
  const logoUrl = companies?.find((c) => c.id === activeCompanyId)?.logoUrl || '';

  // ── كل الـ Hooks في أعلى المكوّن ──
  const [toast, setToast]             = useState({ visible: false, message: '', type: 'success' });
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingSummary, setEditingSummary] = useState(null);

  const { summaries, isLoading: summariesLoading, createSummary, updateSummary, cancelSummary } = useSales({ companyId, startDate: dateFilter.startDate, endDate: dateFilter.endDate });
  const { salesChannels } = useVaults({ companyId });

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
      `📊 *ملخص المبيعات اليومي*`,
      `📋 الرقم: ${s.summaryNumber}`,
      `📅 التاريخ: ${formatSaudiDate(s.transactionDate)}`,
      ``,
      `👥 عدد العملاء: ${cc}`,
      `💰 إجمالي المبيعات: ${fmt(total, 2)} ﷼`,
      `📊 معدل الطلب لكل عميل: ${fmt(avg, 2)} ﷼`,
      Number(s.cashOnHand) > 0 ? `🏦 المبلغ الموجود بالصندوق: ${fmt(s.cashOnHand, 2)} ﷼` : '',
      ``, `🛒 *تفاصيل القنوات:*`, channels,
      s.notes ? `\n📝 ملاحظات: ${s.notes}` : '',
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

  function handleCancelSummary(s) {
    if (!companyId || !window.confirm(t('cancelSummaryConfirm', s.summaryNumber))) return;
    cancelSummary.mutate(
      { id: s.id, companyId },
      {
        onSuccess: () => setToast({ visible: true, message: t('summaryCancelled'), type: 'success' }),
        onError: (e) => setToast({ visible: true, message: e?.message || t('cancelFailed'), type: 'error' }),
      },
    );
  }

  const hasCompany = !!companyId;

  // ── بيانات الجدول (مثل جدول الفواتير) ──
  const statusStyles = useMemo(() => ({
    active:    { bg: 'rgba(22,163,74,0.1)',  color: '#16a34a', label: t('statusActive') },
    cancelled: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: t('statusCancelled') },
  }), [t]);

  const tableData = useMemo(() => summaries.map((s) => {
    const total = Number(s.totalAmount || 0);
    const cc = s.customerCount || 0;
    const channelsText = (s.channels || []).map((ch) => `${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount, 2)}`).join(' | ');
    return {
      ...s,
      channelsText,
      avgPerCustomer: cc > 0 ? total / cc : 0,
    };
  }), [summaries, lang]);

  const { filteredData, allFilteredData, searchText, setSearch, page, setPage, sortKey, sortDir, toggleSort } =
    useTableFilter(tableData, {
      searchKeys: ['summaryNumber', 'channelsText', 'notes'],
      pageSize:   PAGE_SIZE,
      defaultSortKey: 'transactionDate',
      defaultSortDir: 'desc',
    });

  const activeOnly = allFilteredData.filter((s) => s.status !== 'cancelled');
  const displayedTotal = allFilteredData.length;
  const totalAmountSum = sumAmounts(activeOnly, 'totalAmount');
  const totalCustomers = activeOnly.reduce((sum, s) => sum + (s.customerCount || 0), 0);

  const columns = useMemo(() => [
    { key: 'summaryNumber', label: t('summaryNumber'), sortable: true, width: '10%',
      render: (v) => <span style={{ fontWeight: 700, color: 'var(--noorix-accent-blue)', fontFamily: 'var(--noorix-font-numbers)', whiteSpace: 'nowrap' }}>{v}</span> },
    { key: 'transactionDate', label: t('transactionDate'), sortable: true, width: '10%',
      render: (v) => <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', whiteSpace: 'nowrap' }}>{formatSaudiDate(v)}</span> },
    { key: 'channelsText', label: t('salesChannels'), sortable: true, width: '35%',
      render: (v) => <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', minWidth: 0 }} title={v || ''}>{v || '—'}</span> },
    { key: 'customerCount', label: t('customers'), numeric: true, sortable: true, width: '7%',
      render: (v) => <span style={{ color: '#2563eb', fontFamily: 'var(--noorix-font-numbers)' }}>{v ?? 0}</span> },
    { key: 'totalAmount', label: t('total'), numeric: true, sortable: true, width: '10%',
      render: (v) => <span style={{ fontWeight: 700, color: '#16a34a', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(v, 2)}</span> },
    { key: 'avgPerCustomer', label: t('avgPerOrder'), numeric: true, sortable: true, width: '7%',
      render: (v) => <span style={{ color: '#7c3aed', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(v, 2)}</span> },
    { key: 'status', label: t('statusLabel'), width: '8%', render: (v) => <Badge map={statusStyles} value={v} /> },
    { key: 'actions', label: t('actions'), align: 'center', width: '8%',
      render: (_, row) => (
        <SalesActionsCell
          summary={row}
          userRole={userRole}
          onPrint={openWhatsApp}
          onEdit={setEditingSummary}
          onDelete={handleCancelSummary}
        />
      ),
    },
  ], [userRole, t, statusStyles]);

  const footerCells = (
    <>
      <td />
      <td colSpan={3} style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--noorix-text)', textAlign: 'right' }}>{t('totalSummaries', activeOnly.length)}</td>
      <td style={{ padding: '10px 12px', fontFamily: 'var(--noorix-font-numbers)', fontSize: 14, fontWeight: 700, color: '#2563eb', textAlign: 'right' }}>{totalCustomers.toLocaleString('en')}</td>
      <td style={{ padding: '10px 12px', fontFamily: 'var(--noorix-font-numbers)', fontSize: 14, fontWeight: 800, color: '#16a34a', textAlign: 'right' }}>{fmt(totalAmountSum.toNumber(), 2)}</td>
      <td style={{ padding: '10px 12px', fontFamily: 'var(--noorix-font-numbers)', fontSize: 14, fontWeight: 700, color: '#7c3aed', textAlign: 'right' }}>{totalCustomers > 0 ? fmt(totalAmountSum.toNumber() / totalCustomers, 2) : '0.00'}</td>
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
  const exportData = allFilteredData.map((s) => {
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

  function handleExportExcel() {
    exportToExcel({
      columns: exportColumns,
      data: exportData,
      filename: `sales-summaries-${dateFilter.startDate || 'all'}-${dateFilter.endDate || 'all'}`,
      companyName,
      title: `${t('salesDailySummary')} — ${dateFilter.label}`,
      logoUrl,
    });
  }

  function handleExportPdf() {
    exportToPdf({
      columns: exportColumns,
      data: exportData,
      filename: `sales-summaries-${dateFilter.startDate || 'all'}-${dateFilter.endDate || 'all'}`,
      companyName,
      title: `${t('salesDailySummary')} — ${dateFilter.label}`,
      logoUrl,
    });
  }

  function handlePrint() {
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

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      {editingSummary && (
        <SalesEditModal
          summary={editingSummary}
          salesChannels={salesChannels}
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

      {/* هيدر */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('salesDailySummary')}</h1>
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('salesDailyDesc')}</p>
        </div>
        <button type="button" className="noorix-btn-nav noorix-btn-primary noorix-print-hide"
          onClick={() => setShowEntryModal(true)} disabled={!hasCompany}
          style={{ flexShrink: 0 }}>
          {t('addDailySummary')}
        </button>
      </div>

      {/* FAB — زر إضافة عائم للجوال */}
      {hasCompany && (
        <button
          type="button"
          className="noorix-fab noorix-print-hide"
          onClick={() => setShowEntryModal(true)}
        >
          + {t('addDailySummary')}
        </button>
      )}

      <DateFilterBar filter={dateFilter} />

      {!hasCompany && (
        <div className="noorix-surface-card" style={{ padding: 20, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
          {t('pleaseSelectCompany')}
        </div>
      )}

      {/* ── الملخصات السابقة — جدول احترافي ── */}
      {hasCompany && (
        <div className="noorix-sales-table-wrapper">
          <SmartTable
            columns={columns}
            data={filteredData}
            total={displayedTotal}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            isLoading={summariesLoading}
            isError={false}
            errorMessage=""
            footerCells={footerCells}
            title={t('previousSummaries')}
            showRowNumbers
            rowNumberWidth="1%"
            innerPadding={16}
            badge={
            <>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', whiteSpace: 'nowrap' }}>— {dateFilter.label}</span>
              <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: 'rgba(37,99,235,0.1)', color: '#2563eb', fontWeight: 700, whiteSpace: 'nowrap' }}>{t('summaryCount', displayedTotal)}</span>
              <span className="noorix-print-hide" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="noorix-btn-nav" onClick={handleExportExcel} disabled={displayedTotal === 0} style={{ fontSize: 12, padding: '4px 10px' }}>📊 {t('exportExcel')}</button>
                <button type="button" className="noorix-btn-nav" onClick={handleExportPdf} disabled={displayedTotal === 0} style={{ fontSize: 12, padding: '4px 10px' }}>📄 {t('exportPdf')}</button>
                <button type="button" className="noorix-btn-nav" onClick={handlePrint} disabled={displayedTotal === 0} style={{ fontSize: 12, padding: '4px 10px' }}>🖨 {t('print')}</button>
              </span>
            </>
          }
          searchValue={searchText}
          onSearchChange={setSearch}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          emptyMessage={t('noSummariesInPeriod')}
          />
        </div>
      )}
    </div>
  );
}
