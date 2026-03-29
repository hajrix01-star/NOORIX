/**
 * PurchasesBatchScreen — إدخال جماعي لفواتير الموردين
 * تصميم احترافي متكامل — جدول موحد مثل الفواتير، اختصارات مدمجة، ملخص متسق
 */
import React, { useState, useMemo, memo, useCallback, useEffect } from 'react';
import Decimal from 'decimal.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useApp } from '../../context/AppContext';
import { createInvoiceBatch, updateInvoice, getPurchaseBatchSummaries, fetchAllInvoicesForBatch } from '../../services/api';
import { useSuppliers } from '../../hooks/useSuppliers';
import { useCategories } from '../../hooks/useCategories';
import { useVaults } from '../../hooks/useVaults';
import { useBatchSummary } from '../../hooks/useBatchCalculation';
import { useTableFilter } from '../../hooks/useTableFilter';
import { getSaudiToday, formatSaudiDate } from '../../utils/saudiDate';
import { vaultDisplayName } from '../../utils/vaultDisplay';
import { fmt, sumAmounts } from '../../utils/format';
import Toast from '../../components/Toast';
import { useTranslation } from '../../i18n/useTranslation';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
import SmartTable from '../../components/common/SmartTable';
import { BatchRow } from './components/BatchRow';
import { BatchEditPanel } from './components/BatchEditPanel';
import { BatchPrintSheet } from './components/BatchPrintSheet';
import { BatchSummaryBar } from './components/BatchSummaryBar';

const PAGE_SIZE = 50;

const Badge = memo(function Badge({ map, value }) {
  const s = map[value] || { bg: 'rgba(100,116,139,0.08)', color: '#64748b', label: value };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
});

/* ── Bookmarks ────────────────────────────────────────────────── */
const BM_KEY = 'noorix_supplier_bookmarks_v1';
const loadBookmarks = () => { try { return JSON.parse(localStorage.getItem(BM_KEY) || '[]'); } catch { return []; } };
const saveBookmarks = (arr) => localStorage.setItem(BM_KEY, JSON.stringify(arr));

/* ── Row factory ──────────────────────────────────────────────── */
const EMPTY_ROW = () => ({
  key: `${Date.now()}-${Math.random()}`,
  supplierId: '', invoiceNumber: '',
  totalInclusive: '',
  invoiceDate: getSaudiToday(),
  kind: 'purchase',
  isTaxable: true,
  categoryId: '', debitAccountId: '',
  notes: '',
});

/* ── تبويبات الشاشة ─────────────────────────────────────────────── */
function getTabs(t) {
  return [
    { id: 'entry',  label: t('tabNewBatch'), icon: '📝' },
    { id: 'history', label: t('tabSavedBatches'), icon: '📋' },
  ];
}

/* ══ الشاشة الرئيسية — تصميم احترافي ═══════════════════════════════ */
export default function PurchasesBatchScreen() {
  const { activeCompanyId, language } = useApp();
  const { t } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const queryClient = useQueryClient();
  const dateFilter = useDateFilter();

  const [toast, setToast]         = useState({ visible: false, message: '', type: 'success' });
  const [activeTab, setActiveTab] = useState('entry');
  const [batchDate, setBatchDate] = useState(getSaudiToday());
  const [batchVaultId, setBatchVaultId] = useState('');
  const [rows, setRows]           = useState(() => [EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
  const [bookmarks, setBookmarks] = useState(loadBookmarks);
  const [editingBatch, setEditingBatch] = useState(null);
  const [printingBatch, setPrintingBatch] = useState(null);
  const [batchActionLoading, setBatchActionLoading] = useState(null);

  const { suppliers } = useSuppliers(companyId);
  const { flatCategories = [] } = useCategories(companyId);
  const { vaultsList = [] } = useVaults({ companyId });
  const activeVaults = useMemo(() => vaultsList.filter((v) => !v.isArchived), [vaultsList]);

  useEffect(() => {
    setBatchVaultId('');
  }, [companyId]);

  useEffect(() => {
    if (batchVaultId && !activeVaults.some((v) => v.id === batchVaultId)) setBatchVaultId('');
    if (!batchVaultId && activeVaults.length === 1) setBatchVaultId(activeVaults[0].id);
  }, [activeVaults, batchVaultId]);

  const [batchSearchInput, setBatchSearchInput] = useState('');
  const [debouncedBatchQ, setDebouncedBatchQ] = useState('');
  useEffect(() => {
    const tm = setTimeout(() => setDebouncedBatchQ(batchSearchInput.trim()), 300);
    return () => clearTimeout(tm);
  }, [batchSearchInput]);

  const { data: batchSummaryData, isLoading: batchesLoading, isError: batchesError, error: batchesErr } = useQuery({
    queryKey: ['purchase-batch-summaries', companyId, dateFilter.startDate, dateFilter.endDate, debouncedBatchQ],
    queryFn: async () => {
      const res = await getPurchaseBatchSummaries(companyId, dateFilter.startDate, dateFilter.endDate, debouncedBatchQ || undefined);
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل الدفعات');
      return res.data;
    },
    enabled: !!companyId && activeTab === 'history',
  });

  // ── بيانات جدول الدفعات — ملخص من السيرفر (كل الدفعات في الفترة) ──
  const statusStyles = useMemo(() => ({
    active:    { bg: 'rgba(22,163,74,0.1)',  color: '#16a34a', label: t('statusActive') },
    cancelled: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: t('statusCancelled') },
    partial:   { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', label: t('statusPartial') || 'جزئي' },
  }), [t]);

  const batchesTableData = useMemo(() => {
    const list = batchSummaryData?.batches || [];
    return list.map((b) => ({
      batchId: b.batchId,
      invoices: [],
      transactionDate: b.transactionDate,
      invoiceCount: b.invoiceCount,
      supplierNames: b.supplierNames || '—',
      vaultName: b.vaultName || '—',
      netAmount: Number(b.netAmount) || 0,
      taxAmount: Number(b.taxAmount) || 0,
      totalAmount: Number(b.totalAmount) || 0,
      status: b.status,
    }));
  }, [batchSummaryData]);

  const { filteredData, allFilteredData, page, setPage, sortKey, sortDir, toggleSort } =
    useTableFilter(batchesTableData, {
      searchKeys: [],
      pageSize:   PAGE_SIZE,
      defaultSortKey: 'transactionDate',
      defaultSortDir: 'desc',
    });

  useEffect(() => {
    setPage(1);
  }, [debouncedBatchQ, setPage]);

  const activeOnly = allFilteredData.filter((b) => b.status !== 'cancelled');
  const displayedTotal = allFilteredData.length;
  const totalNet    = activeOnly.reduce((s, b) => s.plus(b.netAmount),    new Decimal(0));
  const totalTax    = activeOnly.reduce((s, b) => s.plus(b.taxAmount),    new Decimal(0));
  const totalAmount = activeOnly.reduce((s, b) => s.plus(b.totalAmount),  new Decimal(0));

  const openBatchWithInvoices = useCallback(async (row, setter) => {
    if (!companyId || !row?.batchId) return;
    setBatchActionLoading(row.batchId);
    try {
      const invoices = await fetchAllInvoicesForBatch(companyId, row.batchId, dateFilter.startDate, dateFilter.endDate);
      setter({ ...row, batchId: row.batchId, invoices });
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('loadDataFailed'), type: 'error' });
    } finally {
      setBatchActionLoading(null);
    }
  }, [companyId, dateFilter.startDate, dateFilter.endDate, t]);

  const handleCancelBatch = useCallback(async (batch) => {
    let invoices = batch.invoices;
    if (!invoices?.length) {
      try {
        invoices = await fetchAllInvoicesForBatch(companyId, batch.batchId, dateFilter.startDate, dateFilter.endDate);
      } catch (e) {
        setToast({ visible: true, message: e?.message || t('loadDataFailed'), type: 'error' });
        return;
      }
    }
    if (!confirm(t('cancelBatchConfirm', batch.batchId, invoices.length))) return;
    try {
      for (const inv of invoices) {
        if (inv.status === 'active') {
          const res = await updateInvoice(inv.id, { status: 'cancelled' }, companyId);
          if (!res?.success) throw new Error(res?.error || t('cancelFailed'));
        }
      }
      invalidateOnFinancialMutation(queryClient);
      setToast({ visible: true, message: t('batchCancelled'), type: 'success' });
      setEditingBatch(null);
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('cancelFailed'), type: 'error' });
    }
  }, [companyId, dateFilter.startDate, dateFilter.endDate, queryClient, t]);

  const batchesColumns = useMemo(() => [
    /* رقم الدفعة — ضيق، محتوى ثابت مثل INV-0001 */
    { key: 'batchId', label: t('batchId'), sortable: true, shrink: true,
      render: (v) => (
        <span style={{ fontWeight: 700, color: 'var(--noorix-accent-blue)', fontFamily: 'var(--noorix-font-numbers)', whiteSpace: 'nowrap' }}>{v}</span>
      )},
    /* التاريخ — ضيق، نص ثابت */
    { key: 'transactionDate', label: t('transactionDate'), sortable: true, shrink: true,
      render: (v) => (
        <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--noorix-font-numbers)' }}>{formatSaudiDate(v)}</span>
      )},
    /* عدد الفواتير — ضيق جداً */
    { key: 'invoiceCount', label: t('invoiceCount'), numeric: true, sortable: true, shrink: true,
      render: (v) => (
        <span style={{ color: '#2563eb', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700 }}>{v ?? 0}</span>
      )},
    /* المورد — minWidth يضمن عدم انهيار العمود مع table-layout:auto */
    { key: 'supplierNames', label: t('supplier'), sortable: true, minWidth: 160,
      render: (v) => (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', minWidth: 0 }}>{v || '—'}</span>
      )},
    { key: 'vaultName', label: t('vault'), sortable: true, shrink: true, minWidth: 120,
      render: (v) => (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', minWidth: 0, maxWidth: 200 }}>{v || '—'}</span>
      )},
    /* الأعمدة المالية — ضيقة، محاذاة يمين */
    { key: 'netAmount',   label: t('net'),   numeric: true, sortable: true, shrink: true,
      render: (v) => <span style={{ color: '#16a34a', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(v)}</span> },
    { key: 'taxAmount',   label: t('tax'),   numeric: true, sortable: true, shrink: true,
      render: (v) => <span style={{ color: '#d97706', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(v)}</span> },
    { key: 'totalAmount', label: t('total'), numeric: true, sortable: true, shrink: true,
      render: (v) => <span style={{ fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(v)}</span> },
    /* الحالة — شارة ضيقة */
    { key: 'status', label: t('statusLabel'), shrink: true,
      render: (v) => <Badge map={statusStyles} value={v} /> },
    /* الإجراءات — بدون shrink + minWidth يمنع تداخل الأزرار مع بقية الأعمدة */
    { key: 'actions', label: t('actions'), align: 'center', minWidth: 220,
      render: (_, row) => {
        const canCancel = row.status === 'active' || row.status === 'partial';
        return (
          <div className="noorix-actions-row" style={{ flexWrap: 'wrap', justifyContent: 'center', maxWidth: 280 }}>
            <button type="button" className="noorix-btn-nav"
              onClick={() => openBatchWithInvoices(row, setPrintingBatch)}
              disabled={batchActionLoading === row.batchId}
              style={{ padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap' }} title={t('print')}>
              🖨 {batchActionLoading === row.batchId ? '…' : t('print')}
            </button>
            <button type="button" className="noorix-btn-nav"
              onClick={() => openBatchWithInvoices(row, setEditingBatch)}
              disabled={batchActionLoading === row.batchId}
              style={{ padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap' }} title={t('edit')}>
              ✎ {batchActionLoading === row.batchId ? '…' : t('edit')}
            </button>
            <button type="button" className="noorix-btn-nav"
              onClick={() => handleCancelBatch(row)} disabled={!canCancel || batchActionLoading === row.batchId}
              style={{ padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap', borderColor: '#fecaca', background: 'rgba(239,68,68,0.06)', color: '#dc2626' }} title={t('cancel')}>
              × {t('cancel')}
            </button>
          </div>
        );
      },
    },
  ], [t, statusStyles, batchActionLoading, openBatchWithInvoices, handleCancelBatch]);

  const renderBatchMobileCard = useCallback((row) => {
    const ss = statusStyles[row.status] || { bg: 'rgba(100,116,139,0.1)', color: '#64748b', label: row.status };
    const canCancel = row.status === 'active' || row.status === 'partial';
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <span style={{ fontWeight: 700, color: 'var(--noorix-accent-blue)', fontFamily: 'var(--noorix-font-numbers)', fontSize: 14 }}>{row.batchId}</span>
          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: ss.bg, color: ss.color, flexShrink: 0 }}>{ss.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--noorix-text-muted)', marginBottom: 6 }}>
          <span>{formatSaudiDate(row.transactionDate)}</span>
          {row.invoiceCount > 0 && <span style={{ color: '#2563eb', fontWeight: 700 }}>{row.invoiceCount} {t('invoices')}</span>}
        </div>
        {row.supplierNames && <div style={{ fontSize: 13, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.supplierNames}</div>}
        <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--noorix-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t('vault')}: {row.vaultName || '—'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, background: 'var(--noorix-bg-page)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginBottom: 2 }}>{t('net')}</div>
            <div style={{ fontSize: 13, color: '#16a34a', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700 }}>{fmt(row.netAmount)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginBottom: 2 }}>{t('tax')}</div>
            <div style={{ fontSize: 13, color: '#d97706', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(row.taxAmount)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginBottom: 2 }}>{t('total')}</div>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(row.totalAmount)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="noorix-btn-nav" style={{ padding: '6px 12px', fontSize: 12, minHeight: 34 }} onClick={() => openBatchWithInvoices(row, setPrintingBatch)} disabled={batchActionLoading === row.batchId}>🖨 {t('print')}</button>
          <button type="button" className="noorix-btn-nav" style={{ padding: '6px 12px', fontSize: 12, minHeight: 34 }} onClick={() => openBatchWithInvoices(row, setEditingBatch)} disabled={batchActionLoading === row.batchId}>✎ {t('edit')}</button>
          {canCancel && <button type="button" className="noorix-btn-nav" style={{ padding: '6px 12px', fontSize: 12, minHeight: 34, borderColor: '#fecaca', background: 'rgba(239,68,68,0.06)', color: '#dc2626' }} onClick={() => handleCancelBatch(row)} disabled={batchActionLoading === row.batchId}>× {t('cancel')}</button>}
        </div>
      </div>
    );
  }, [statusStyles, t, batchActionLoading, openBatchWithInvoices, handleCancelBatch]);

  /* صف التذييل: # + batchId + تاريخ + عدد + مورد + خزنة + صافي + ضريبة + إجمالي + حالة + إجراءات = 11 عموداً */
  const batchesFooterCells = (
    <>
      <td colSpan={6} style={{ padding: '8px 10px', fontSize: 12, color: 'var(--noorix-text-muted)', verticalAlign: 'middle' }}>
        {t('totalBatches', activeOnly.length) || `الإجمالي (${activeOnly.length} دفعة)`}
      </td>
      <td style={{ padding: '8px 10px', fontFamily: 'var(--noorix-font-numbers)', color: '#16a34a', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(totalNet, 2)}</td>
      <td style={{ padding: '8px 10px', fontFamily: 'var(--noorix-font-numbers)', color: '#d97706', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(totalTax, 2)}</td>
      <td style={{ padding: '8px 10px', fontFamily: 'var(--noorix-font-numbers)', color: '#7c3aed', fontWeight: 900, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(totalAmount, 2)}</td>
      <td colSpan={2} style={{ padding: '8px 10px' }} />
    </>
  );

  const bookmarkedSuppliers = useMemo(
    () => suppliers.filter((s) => bookmarks.includes(s.id)),
    [suppliers, bookmarks],
  );

  const summary = useBatchSummary(rows);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const valid = rows.filter((r) => {
        try {
          if (!r.invoiceNumber || new Decimal(r.totalInclusive || 0).lte(0)) return false;
          if (r.supplierId) return true;
          if ((r.kind === 'fixed_expense' || r.kind === 'expense') && r.notes?.trim()) return true;
          return false;
        } catch { return false; }
      });
      if (!valid.length) throw new Error(t('noValidRows'));
      const idempotencyKey = `pur-${companyId}-${batchDate}-${Date.now()}`;
      const res = await createInvoiceBatch({
        companyId,
        transactionDate: batchDate,
        vaultId: batchVaultId || undefined,
        idempotencyKey,
        items: valid.map((r) => {
          let notes = r.notes?.trim();
          if (r.supplierId) {
            const sup = suppliers.find((s) => s.id === r.supplierId);
            const name = sup?.nameAr || sup?.nameEn || '';
            notes = name ? `${t('opInvoicePayment')} — ${name}` : notes;
          } else if (r.kind === 'fixed_expense') {
            notes = notes ? `مصروف ثابت — ${notes}` : 'مصروف ثابت';
          } else if (r.kind === 'expense') {
            notes = notes ? `مصروف متغير — ${notes}` : 'مصروف متغير';
          }
          return {
            supplierId: r.supplierId || undefined,
            supplierInvoiceNumber: r.invoiceNumber?.trim() || undefined,
            kind: r.kind || 'purchase',
            totalAmount: parseFloat(r.totalInclusive),
            isTaxable: r.isTaxable !== false,
            invoiceDate: r.invoiceDate,
            debitAccountId: r.debitAccountId || undefined,
            notes: notes || undefined,
          };
        }),
      });
      if (!res.success) throw new Error(res.error || t('saveFailed'));
      return res.data ?? { batchId: 'B-' + Date.now(), count: valid.length };
    },
    onSuccess: (data) => {
      invalidateOnFinancialMutation(queryClient);
      setToast({ visible: true, message: t('savedInvoicesCount', data.count, data.batchId), type: 'success' });
      setRows([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' }),
  });

  const updateRow = (i, f, v) => {
    if (typeof f === 'object' && f !== null) {
      setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...f } : r)));
    } else {
      setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [f]: v } : r)));
    }
  };
  const addRow         = ()         => setRows((p) => [...p, EMPTY_ROW()]);
  const removeRow      = (i)        => setRows((p) => p.length <= 1 ? [EMPTY_ROW()] : p.filter((_, idx) => idx !== i));
  const toggleBookmark = (id)       => setBookmarks((p) => { const n = p.includes(id) ? p.filter((x) => x !== id) : [...p, id]; saveBookmarks(n); return n; });
  const addBookmarked  = (id)       => {
    const s = suppliers.find((x) => x.id === id);
    const cat = s?.supplierCategory;
    const base = { ...EMPTY_ROW(), supplierId: id };
    if (cat) {
      base.kind = cat.type === 'expense' ? 'expense' : 'purchase';
      base.categoryId = cat.id;
      base.debitAccountId = cat.accountId || cat.account?.id || '';
      base.isTaxable = !(cat.account?.taxExempt ?? false);
    }
    setRows((p) => [...p, base]);
  };

  async function saveInvoiceEdit(inv) {
    const payload = {
      supplierId: inv.supplierId,
      supplierInvoiceNumber: inv.supplierInvoiceNumber ?? inv.invoiceNumber,
      kind: inv.kind,
      totalAmount: inv.totalAmount,
      netAmount: inv.netAmount,
      taxAmount: inv.taxAmount,
      status: inv.status,
    };
    return updateInvoice(inv.id, payload, companyId);
  }

  const hasCompany = !!companyId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      {/* ── الهيدر ── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>{t('batchPurchasesTitle')}</h1>
          <p style={{ marginTop: 6, fontSize: 14, color: 'var(--noorix-text-muted)', lineHeight: 1.4 }}>
            {t('batchPurchasesDesc')}
          </p>
        </div>
      </header>

      {/* ── التبويبات ── */}
      {hasCompany && (
        <div className="noorix-tab-bar" style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--noorix-border)', paddingBottom: 0 }}>
          {getTabs(t).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--noorix-accent-blue)' : '2px solid transparent',
                marginBottom: -2, background: 'transparent', color: activeTab === tab.id ? 'var(--noorix-accent-blue)' : 'var(--noorix-text-muted)',
                transition: 'color 150ms, border-color 150ms', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      )}

      {!hasCompany && (
        <div className="noorix-surface-card" style={{ padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)', fontSize: 14 }}>
          {t('pleaseSelectCompany')}
        </div>
      )}

      {/* ── تبويب: إدخال دفعة جديدة ── */}
      {activeTab === 'entry' && hasCompany && (
        <div className="noorix-surface-card" style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {/* شريط الأدوات */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 12px',
            background: 'var(--noorix-bg-page)', borderBottom: '1px solid var(--noorix-border)',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--noorix-text-muted)', whiteSpace: 'nowrap' }}>{t('transactionDateLabel')}</label>
              <input
                type="date"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)',
                  fontSize: 13, background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)',
                  fontFamily: 'var(--noorix-font-numbers)',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, minWidth: 0, maxWidth: 280 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--noorix-text-muted)', whiteSpace: 'nowrap' }} htmlFor="batch-purchase-vault">
                {t('batchPurchasesPayVault')}
              </label>
              <select
                id="batch-purchase-vault"
                value={batchVaultId}
                onChange={(e) => setBatchVaultId(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)',
                  fontSize: 13, background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)',
                  maxWidth: '100%',
                }}
              >
                <option value="">{t('batchPurchasesVaultPlaceholder')}</option>
                {activeVaults.map((v) => (
                  <option key={v.id} value={v.id}>{vaultDisplayName(v, language)}</option>
                ))}
              </select>
              <span style={{ fontSize: 10, color: 'var(--noorix-text-muted)', lineHeight: 1.35, maxWidth: 260 }}>
                {t('batchPurchasesPayVaultHint')}
              </span>
            </div>
            <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--noorix-text-muted)', whiteSpace: 'nowrap' }}>{t('shortcuts')}</span>
              {bookmarkedSuppliers.length > 0 ? (
                bookmarkedSuppliers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addBookmarked(s.id)}
                    style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
                      color: 'var(--noorix-text)', whiteSpace: 'nowrap',
                    }}
                  >
                    {s.nameAr || s.nameEn}
                  </button>
                ))
              ) : (
                <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('selectSupplierBookmark')}</span>
              )}
            </div>
          </div>

          {activeVaults.length === 0 && (
            <div style={{ padding: '10px 16px', fontSize: 13, color: '#b45309', background: 'rgba(245,158,11,0.12)', borderBottom: '1px solid var(--noorix-border)' }}>
              {t('batchPurchasesNoVaults')}
            </div>
          )}

          {/* جدول الإدخال */}
          <div style={{ padding: '0 12px 16px' }}>
            <div className="noorix-surface-card noorix-table-frame batch-purchases-table" style={{ width: '100%' }}>
              <table className="noorix-table" style={{ width: '100%', tableLayout: 'fixed', minWidth: 900 }}>
                <colgroup><col style={{ width: '3%' }} /><col style={{ width: '20%' }} /><col style={{ width: '11%' }} /><col style={{ width: '8%' }} /><col style={{ width: '9%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '11%' }} /><col style={{ width: '5%' }} /><col style={{ width: '14%' }} /><col style={{ width: '3%' }} /></colgroup>
                <thead>
                  <tr>
                    {[
                      { label: '#',                        align: 'center' },
                      { label: t('supplier'),              align: 'right'  },
                      { label: t('supplierInvoiceNumber'), align: 'center' },
                      { label: t('total'),                 align: 'center' },
                      { label: `${t('net')} / ${t('tax')}`, align: 'center' },
                      { label: t('date'),                  align: 'center' },
                      { label: t('type'),                  align: 'center' },
                      { label: t('category'),              align: 'center' },
                      { label: 'ض%',                       align: 'center', title: 'ضريبة القيمة المضافة' },
                      { label: t('notes'),                 align: 'right'  },
                      { label: '',                         align: 'center' },
                    ].map(({ label, align, title }, i) => (
                      <th key={i} title={title} style={{
                        padding: '8px 6px', textAlign: align, fontSize: 11, fontWeight: 700,
                        color: 'var(--noorix-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden',
                      }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <BatchRow
                      key={r.key}
                      row={r}
                      index={i}
                      suppliers={suppliers}
                      categories={flatCategories}
                      bookmarkedIds={bookmarks}
                      onUpdate={updateRow}
                      onRemove={removeRow}
                      onBookmark={toggleBookmark}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              className="noorix-btn-nav"
              onClick={addRow}
              style={{ marginTop: 12, fontSize: 13 }}
            >
              {t('addRow')}
            </button>

            <BatchSummaryBar
              count={summary.count}
              net={summary.net.toNumber()}
              tax={summary.tax.toNumber()}
              total={summary.total.toNumber()}
            />

            {/* أزرار الإجراءات */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', width: '100%' }}>
              <button
                type="button"
                className="noorix-btn-nav noorix-btn-success"
                disabled={saveMutation.isPending || summary.count === 0 || !batchVaultId || activeVaults.length === 0}
                onClick={() => saveMutation.mutate()}
                style={{ flex: '1 1 200px', padding: '12px 20px', fontSize: 14, fontWeight: 700, minWidth: 0 }}
              >
                {saveMutation.isPending ? t('saving') : t('saveBatch', summary.count)}
              </button>
              <button
                type="button"
                className="noorix-btn-nav"
                onClick={() => window.print()}
                style={{ padding: '12px 20px', fontSize: 14, flexShrink: 0, flex: '0 1 auto' }}
              >
                {t('print')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── تبويب: الدفعات المحفوظة — جدول مثل الفواتير ── */}
      {activeTab === 'history' && hasCompany && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <DateFilterBar filter={dateFilter} />

          <SmartTable
            columns={batchesColumns}
            data={filteredData}
            showRowNumbers
            rowNumberWidth={40}
            tableLayout="auto"
            tableMinWidth={1240}
            innerPadding={8}
            total={displayedTotal}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            isLoading={batchesLoading}
            isError={!!batchesError}
            errorMessage={batchesErr?.message || ''}
            footerCells={batchesFooterCells}
            title={t('tabSavedBatches')}
            badge={
              <>
                <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>— {dateFilter.label}</span>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 700 }}>{t('batchCount', displayedTotal)}</span>
              </>
            }
            searchValue={batchSearchInput}
            onSearchChange={(v) => { setBatchSearchInput(v); setPage(1); }}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            emptyMessage={t('noBatchesInPeriod')}
            renderMobileCard={renderBatchMobileCard}
            stickyActionColumn={false}
          />
        </div>
      )}

      {printingBatch && (
        <BatchPrintSheet
          batch={printingBatch}
          onClose={() => setPrintingBatch(null)}
        />
      )}

      {editingBatch && (
        <BatchEditPanel
          batch={editingBatch}
          suppliers={suppliers}
          companyId={companyId}
          onSaveInvoice={saveInvoiceEdit}
          onClose={() => {
            setEditingBatch(null);
            invalidateOnFinancialMutation(queryClient);
          }}
        />
      )}
    </div>
  );
}
