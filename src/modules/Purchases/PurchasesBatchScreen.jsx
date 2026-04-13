/**
 * PurchasesBatchScreen — إدخال جماعي لفواتير الموردين
 * تصميم احترافي متكامل — جدول موحد مثل الفواتير، اختصارات مدمجة، ملخص متسق
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Decimal from 'decimal.js';
import { Button, Badge, Input, ScreenTabs, ScreenShell, SmartTable } from '../../ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../hooks/useApiMutation';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { rejectIfApiFailed } from '../../utils/apiResponse';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { createInvoiceBatch, updateInvoice, getPurchaseBatchSummaries, fetchAllInvoicesForBatch, throwIfApiFailed, setSupplierBookmark } from '../../services/api';
import { useSuppliers } from '../../hooks/useSuppliers';
import { useCategories } from '../../hooks/useCategories';
import { useVaults } from '../../hooks/useVaults';
import { useBatchSummary } from '../../hooks/useBatchCalculation';
import { useTableFilter } from '../../hooks/useTableFilter';
import { getSaudiToday, formatSaudiDate } from '../../utils/saudiDate';
import { vaultDisplayName } from '../../utils/vaultDisplay';
import { fmt, sumAmounts } from '../../utils/format';
import { useTranslation } from '../../i18n/useTranslation';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
import { BatchRow } from './components/BatchRow';
import { BatchEditPanel } from './components/BatchEditPanel';
import { BatchPrintSheet } from './components/BatchPrintSheet';
import { BatchSummaryBar } from './components/BatchSummaryBar';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useIsNarrow700 } from '../../hooks/useMediaQuery';
import { buildActiveCancelledPartialStatusMap } from '../../constants/badgeMaps';

const PAGE_SIZE = 50;

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
    { id: 'entry',  label: t('tabNewBatch'), icon: '' },
    { id: 'history', label: t('tabSavedBatches'), icon: '' },
  ];
}

/* ══ الشاشة الرئيسية — تصميم احترافي ═══════════════════════════════ */
export default function PurchasesBatchScreen() {
  const { activeCompanyId, language } = useApp();
  const { t, lang } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const queryClient = useQueryClient();
  const dateFilter = useDateFilter();

  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('entry');
  const [batchDate, setBatchDate] = useState(getSaudiToday());
  /** آخر تاريخ عملية مُطبَّق على الصفوف — لمزامنة رفع/خفض تاريخ الفاتورة مع تاريخ العملية */
  const prevBatchDateRef = useRef(batchDate);
  const [batchVaultId, setBatchVaultId] = useState('');
  /** تُطبَّق على كل فاتورة في الدفعة بعد ملاحظة السطر، مفصولاً بـ « + » */
  const [batchNotes, setBatchNotes] = useState('');
  const [rows, setRows]           = useState(() => [EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
  const [editingBatch, setEditingBatch] = useState(null);
  const [printingBatch, setPrintingBatch] = useState(null);
  const [batchActionLoading, setBatchActionLoading] = useState(null);

  const { suppliers } = useSuppliers(companyId);

  /* ── مفضلة الموردين — مشتقة من قاعدة البيانات ── */
  const bookmarks = useMemo(
    () => suppliers.filter((s) => s.isBookmarked).map((s) => s.id),
    [suppliers],
  );
  const { flatCategories = [] } = useCategories(companyId);
  const { paymentVaults: activeVaults = [], isLoading: vaultsLoading } = useVaults({ companyId });

  useEffect(() => {
    setBatchVaultId('');
  }, [companyId]);

  useEffect(() => {
    if (batchVaultId && !activeVaults.some((v) => v.id === batchVaultId)) setBatchVaultId('');
  }, [activeVaults, batchVaultId]);

  const [batchSearchInput, setBatchSearchInput] = useState('');
  const [showCancelledBatches, setShowCancelledBatches] = useState(false);
  const debouncedBatchQ = useDebouncedValue(batchSearchInput.trim(), 300);

  const { data: batchSummaryData, isLoading: batchesLoading, isError: batchesError, error: batchesErr } = useQuery({
    queryKey: ['purchase-batch-summaries', companyId, dateFilter.startDate, dateFilter.endDate, debouncedBatchQ, lang],
    queryFn: async () => {
      const res = await getPurchaseBatchSummaries(companyId, dateFilter.startDate, dateFilter.endDate, debouncedBatchQ || undefined, lang);
      throwIfApiFailed(res, t('loadBatchFailed'));
      return res.data;
    },
    enabled: !!companyId && activeTab === 'history',
  });

  // ── بيانات جدول الدفعات — ملخص من السيرفر (كل الدفعات في الفترة) ──
  const statusBadgeMap = useMemo(() => buildActiveCancelledPartialStatusMap(t), [t]);

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

  /** افتراضياً إخفاء الدفعات الملغاة — زر لإظهارها */
  const batchesForTable = useMemo(() => {
    if (showCancelledBatches) return batchesTableData;
    return batchesTableData.filter((b) => b.status !== 'cancelled');
  }, [batchesTableData, showCancelledBatches]);

  const { filteredData, allFilteredData, page, setPage, sortKey, sortDir, toggleSort } =
    useTableFilter(batchesForTable, {
      searchKeys: [],
      pageSize:   PAGE_SIZE,
      defaultSortKey: 'transactionDate',
      defaultSortDir: 'desc',
    });

  useEffect(() => {
    setPage(1);
  }, [debouncedBatchQ, showCancelledBatches, setPage]);

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
      showToast(e?.message || t('loadDataFailed'), 'error');
    } finally {
      setBatchActionLoading(null);
    }
  }, [companyId, dateFilter.startDate, dateFilter.endDate, t, showToast]);

  const handleCancelBatch = useCallback(async (batch) => {
    let invoices = batch.invoices;
    if (!invoices?.length) {
      try {
        invoices = await fetchAllInvoicesForBatch(companyId, batch.batchId, dateFilter.startDate, dateFilter.endDate);
      } catch (e) {
        showToast(e?.message || t('loadDataFailed'), 'error');
        return;
      }
    }
    if (!confirm(t('cancelBatchConfirm', batch.batchId, invoices.length))) return;
    try {
      for (const inv of invoices) {
        if (inv.status === 'active') {
          const res = await updateInvoice(inv.id, { status: 'cancelled' }, companyId);
          rejectIfApiFailed(res, t('cancelFailed'));
        }
      }
      invalidateOnFinancialMutation(queryClient);
      showToast(t('batchCancelled'), 'success');
      setEditingBatch(null);
    } catch (e) {
      showToast(e?.message || t('cancelFailed'), 'error');
    }
  }, [companyId, dateFilter.startDate, dateFilter.endDate, queryClient, t, showToast]);

  const batchesColumns = useMemo(() => [
    { key: 'batchId', label: t('batchId'), sortable: true, width: '10%',
      render: (v) => (
        <span className="font-bold nx-cell-ellipsis" style={{ color: 'var(--noorix-accent-blue)', fontFamily: 'var(--noorix-font-numbers)' }}>{v}</span>
      )},
    { key: 'transactionDate', label: t('transactionDate'), sortable: true, width: '8%',
      render: (v) => (
        <span className="text-[12px] text-noorix-muted" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{formatSaudiDate(v)}</span>
      )},
    { key: 'invoiceCount', label: t('invoicesColHeader'), numeric: true, sortable: true, width: '6%',
      render: (v) => (
        <span className="font-bold" style={{ color: 'var(--noorix-accent-blue)', fontFamily: 'var(--noorix-font-numbers)' }}>{v ?? 0}</span>
      )},
    { key: 'supplierNames', label: t('supplier'), sortable: true, width: '20%',
      render: (v) => (
        <span className="nx-cell-ellipsis block">{v || '—'}</span>
      )},
    { key: 'vaultName', label: t('vault'), sortable: true, width: '13%',
      render: (v) => (
        <span className="nx-cell-ellipsis block">{v || '—'}</span>
      )},
    { key: 'netAmount', label: t('net'), numeric: true, sortable: true, width: '8%',
      render: (v) => <span className="text-noorix-green" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(v)}</span> },
    { key: 'taxAmount', label: t('tax'), numeric: true, sortable: true, width: '7%',
      render: (v) => <span className="text-noorix-amber" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(v)}</span> },
    { key: 'totalAmount', label: t('total'), numeric: true, sortable: true, width: '8%',
      render: (v) => <span className="font-bold" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(v)}</span> },
    { key: 'status', label: t('statusLabel'), width: '8%',
      render: (v) => <Badge {...Badge.fromStatus(v, statusBadgeMap)} size="sm" /> },
    { key: 'actions', label: t('actions'), align: 'center', width: '12%',
      render: (_, row) => {
        const canCancel = row.status === 'active' || row.status === 'partial';
        return (
          <div className="noorix-actions-row flex flex-wrap justify-center max-w-[280px]">
            <Button size="sm" onClick={() => openBatchWithInvoices(row, setPrintingBatch)} disabled={batchActionLoading === row.batchId} title={t('print')}>
              {batchActionLoading === row.batchId ? '…' : t('print')}
            </Button>
            <Button size="sm" onClick={() => openBatchWithInvoices(row, setEditingBatch)} disabled={batchActionLoading === row.batchId} title={t('edit')}>
              ✎ {batchActionLoading === row.batchId ? '…' : t('edit')}
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleCancelBatch(row)} disabled={!canCancel || batchActionLoading === row.batchId} title={t('cancel')}>
              × {t('cancel')}
            </Button>
          </div>
        );
      },
    },
  ], [t, statusBadgeMap, batchActionLoading, openBatchWithInvoices, handleCancelBatch]);

  const renderBatchMobileCard = useCallback((row) => {
    const canCancel = row.status === 'active' || row.status === 'partial';
    return (
      <div>
        <div className="flex mb-1 justify-between items-start">
          <span className="font-bold text-[14px] text-noorix-blue" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{row.batchId}</span>
          <Badge {...Badge.fromStatus(row.status, statusBadgeMap)} size="sm" />
        </div>
        <div className="flex gap-2.5 text-[12px] text-noorix-muted mb-1.5">
          <span>{formatSaudiDate(row.transactionDate)}</span>
          {row.invoiceCount > 0 && <span className="font-bold text-noorix-blue">{row.invoiceCount} {t('invoices')}</span>}
        </div>
        {row.supplierNames && (
          <div className="text-[13px] mb-1 text-end leading-snug break-words">{row.supplierNames}</div>
        )}
        <div className="text-[12px] mb-2 text-noorix-muted text-end break-words">
          {t('vault')}: {row.vaultName || '—'}
        </div>
        <div className="nx-mc__grid nx-mc__grid--3 mb-2.5">
          <div>
            <div className="nx-mc__stat-label">{t('net')}</div>
            <div className="nx-mc__stat-value text-[13px] text-noorix-green">{fmt(row.netAmount)}</div>
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('tax')}</div>
            <div className="nx-mc__stat-value text-[13px] text-noorix-amber">{fmt(row.taxAmount)}</div>
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('total')}</div>
            <div className="nx-mc__stat-value text-[14px] font-extrabold text-noorix-text">{fmt(row.totalAmount)}</div>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          <Button size="sm" onClick={() => openBatchWithInvoices(row, setPrintingBatch)} disabled={batchActionLoading === row.batchId}>{t('print')}</Button>
          <Button size="sm" onClick={() => openBatchWithInvoices(row, setEditingBatch)} disabled={batchActionLoading === row.batchId}>✎ {t('edit')}</Button>
          {canCancel && <Button size="sm" variant="danger" onClick={() => handleCancelBatch(row)} disabled={batchActionLoading === row.batchId}>× {t('cancel')}</Button>}
        </div>
      </div>
    );
  }, [statusBadgeMap, t, batchActionLoading, openBatchWithInvoices, handleCancelBatch]);

  /* صف التذييل — مدرك لإخفاء الأعمدة عبر footerRow */
  const batchesFooterRow = useMemo(() => [
    {
      keys: ['batchId', 'transactionDate', 'invoiceCount', 'supplierNames', 'vaultName'],
      className: 'nx-tfoot-label text-[12px] text-center',
      content: t('totalBatches', activeOnly.length) || `الإجمالي (${activeOnly.length} دفعة)`,
    },
    {
      keys: ['netAmount'],
      className: 'nx-tfoot-num nx-cell-num--green text-center',
      content: fmt(totalNet),
    },
    {
      keys: ['taxAmount'],
      className: 'nx-tfoot-num nx-cell-num--amber text-center',
      content: fmt(totalTax),
    },
    {
      keys: ['totalAmount'],
      className: 'nx-tfoot-num nx-cell-num--violet text-center',
      content: fmt(totalAmount),
    },
  ], [t, activeOnly.length, totalNet, totalTax, totalAmount]);

  const summary = useBatchSummary(rows);
  const batchEntryNarrow = useIsNarrow700();

  const saveMutation = useApiMutation({
    mutationFn: async () => {
      const batchPart = batchNotes.trim();
      const valid = rows.filter((r) => {
        try {
          if (!r.invoiceNumber || new Decimal(r.totalInclusive || 0).lte(0)) return false;
          if (r.supplierId) return true;
          if ((r.kind === 'fixed_expense' || r.kind === 'expense') && (r.notes?.trim() || batchPart)) return true;
          return false;
        } catch { return false; }
      });
      if (!valid.length) throw new Error(t('noValidRows'));
      const idempotencyKey = `pur-${companyId}-${batchDate}-${Date.now()}`;
      const res = await createInvoiceBatch({
        companyId,
        transactionDate: batchDate,
        vaultId: batchVaultId || undefined,
        batchNotes: batchPart || undefined,
        idempotencyKey,
        items: valid.map((r) => {
          let notes = r.notes?.trim();
          if (r.kind === 'fixed_expense') {
            notes = notes ? `${t('fixedExpenseType')} — ${notes}` : t('fixedExpenseType');
          } else if (r.kind === 'expense') {
            notes = notes ? `${t('expenseType')} — ${notes}` : t('expenseType');
          }
          return {
            supplierId: r.supplierId || undefined,
            supplierInvoiceNumber: r.invoiceNumber?.trim() || undefined,
            kind: r.kind || 'purchase',
            totalAmount: parseFloat(r.totalInclusive),
            isTaxable: r.isTaxable !== false,
            invoiceDate: r.invoiceDate,
            categoryId: r.categoryId || undefined,
            debitAccountId: r.debitAccountId || undefined,
            notes: notes || undefined,
          };
        }),
      });
      rejectIfApiFailed(res, t('saveFailed'));
      return res.data ?? { batchId: 'B-' + Date.now(), count: valid.length };
    },
    successToast: (data) => t('savedInvoicesCount', data.count, data.batchId),
    errorToast: (e) => e?.message || t('saveFailed'),
    onSuccess: () => {
      invalidateOnFinancialMutation(queryClient);
      setRows([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
      setBatchNotes('');
    },
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
  const toggleBookmark = useCallback(async (id) => {
    const current = bookmarks.includes(id);
    try {
      await setSupplierBookmark(id, !current);
      queryClient.invalidateQueries({ queryKey: ['suppliers', companyId] });
    } catch {
      showToast(t('bookmarkUpdateFailed'), 'error');
    }
  }, [bookmarks, companyId, queryClient, showToast]);

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

  const purchaseBatchTabItems = useMemo(
    () => getTabs(t).map((tab) => ({ id: tab.id, label: tab.icon ? <>{tab.icon} {tab.label}</> : tab.label })),
    [t],
  );

  return (
    <ScreenShell className="w-full">
      {/* ── الهيدر ── */}
      <header className="nx-page-header">
        <div className="nx-page-header__titles">
          <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('batchPurchasesTitle')}</h1>
        </div>
      </header>

      {!hasCompany && (
        <div className="noorix-surface-card text-center text-noorix-muted text-[14px] p-6">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {hasCompany && (
        <ScreenTabs
          items={purchaseBatchTabItems}
          value={activeTab}
          onChange={setActiveTab}
          contentClassName="nx-tab-content p-0 min-h-0"
          animateContent={false}
        >
      {activeTab === 'entry' && (
        <div>
          {/* شريط الأدوات */}
          <div className="batch-purchases-entry-toolbar border-b border-noorix-border bg-noorix-bg">
            <div className="batch-purchases-entry-toolbar__control">
              <label className="text-[12px] font-bold text-noorix-muted whitespace-nowrap" htmlFor="batch-purchase-date">{t('transactionDateLabel')}</label>
              <Input
                id="batch-purchase-date"
                type="date"
                value={batchDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  const prevOp = prevBatchDateRef.current;
                  setBatchDate(newDate);
                  if (!newDate) return;
                  setRows((prevRows) =>
                    prevRows.map((r) => {
                      let inv = r.invoiceDate;
                      if (prevOp && newDate !== prevOp) {
                        if (newDate < prevOp) {
                          if (inv && inv > newDate) inv = newDate;
                        } else if (newDate > prevOp) {
                          if (inv === prevOp) inv = newDate;
                        }
                      }
                      return { ...r, invoiceDate: inv };
                    }),
                  );
                  prevBatchDateRef.current = newDate;
                }}
                className="nx-font-numbers"
              />
            </div>
            <div className="batch-purchases-entry-toolbar__control">
              <label className="text-[12px] font-bold text-noorix-muted whitespace-nowrap" htmlFor="batch-purchase-vault">{t('batchPurchasesPayVault')}</label>
              <Input
                id="batch-purchase-vault"
                type="select"
                value={batchVaultId}
                onChange={(e) => setBatchVaultId(e.target.value)}
              >
                <option value="">{t('batchPurchasesVaultPlaceholder')}</option>
                {activeVaults.map((v) => (
                  <option key={v.id} value={v.id}>{vaultDisplayName(v, language)}</option>
                ))}
              </Input>
            </div>
            <div className="batch-purchases-entry-toolbar__control batch-purchases-entry-toolbar__control--grow min-w-0 flex-1 basis-[min(100%,280px)]">
              <label className="text-[12px] font-bold text-noorix-muted whitespace-nowrap" htmlFor="batch-purchase-batch-notes">{t('batchPurchasesBatchNotes')}</label>
              <Input
                id="batch-purchase-batch-notes"
                type="text"
                multiline
                rows={2}
                value={batchNotes}
                onChange={(e) => setBatchNotes(e.target.value)}
                className="w-full min-w-0"
              />
            </div>
          </div>

          {!vaultsLoading && activeVaults.length === 0 && (
            <div className="text-[13px] border-b border-noorix-border py-[10px] px-4 text-noorix-amber bg-[var(--noorix-yellow-12)]">
              {t('batchPurchasesNoVaults')}
            </div>
          )}

          {/* جدول الإدخال — عمودي بالبطاقات تحت 700px */}
          <div className="px-3 pb-4">
            {batchEntryNarrow ? (
              <div className="flex flex-col gap-3 min-w-0">
                {rows.map((r, i) => (
                  <BatchRow
                    key={r.key}
                    layout="stack"
                    row={r}
                    index={i}
                    suppliers={suppliers}
                    categories={flatCategories}
                    bookmarkedIds={bookmarks}
                    onUpdate={updateRow}
                    onRemove={removeRow}
                    onBookmark={toggleBookmark}
                    maxInvoiceDate={batchDate}
                  />
                ))}
              </div>
            ) : (
              <div className="noorix-table-frame batch-purchases-table w-full overflow-x-auto">
                <table className="noorix-table w-full table-fixed min-w-[900px]">
                  <colgroup><col style={{ width: '3%' }} /><col style={{ width: '20%' }} /><col style={{ width: '11%' }} /><col style={{ width: '8%' }} /><col style={{ width: '9%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '11%' }} /><col style={{ width: '5%' }} /><col style={{ width: '14%' }} /><col style={{ width: '3%' }} /></colgroup>
                  <thead>
                    <tr>
                      {[
                        { label: '#', align: 'center' },
                        { label: t('supplier'), align: 'right' },
                        { label: t('supplierInvoiceNumber'), align: 'center' },
                        { label: t('total'), align: 'center' },
                        { label: `${t('net')} / ${t('tax')}`, align: 'center' },
                        { label: t('date'), align: 'center' },
                        { label: t('type'), align: 'center' },
                        { label: t('category'), align: 'center' },
                        { label: t('taxPct'), align: 'center', title: t('taxPctTitle') },
                        { label: t('notes'), align: 'right' },
                        { label: '', align: 'center' },
                      ].map(({ label, align, title }, i) => (
                        <th key={i} title={title} className="text-[11px] font-bold text-noorix-muted overflow-hidden whitespace-nowrap py-2 px-1.5" style={{ textAlign: align }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <BatchRow
                        key={r.key}
                        layout="table"
                        row={r}
                        index={i}
                        suppliers={suppliers}
                        categories={flatCategories}
                        bookmarkedIds={bookmarks}
                        onUpdate={updateRow}
                        onRemove={removeRow}
                        onBookmark={toggleBookmark}
                        maxInvoiceDate={batchDate}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button
              size="sm"
              onClick={addRow}
              className="mt-3"
            >
              {t('addRow')}
            </Button>

            <BatchSummaryBar
              count={summary.count}
              net={summary.net.toNumber()}
              tax={summary.tax.toNumber()}
              total={summary.total.toNumber()}
            />

            {/* أزرار الإجراءات */}
            <div className="nx-toolbar mt-5">
              <Button
                size="sm"
                variant="primary"
                disabled={saveMutation.isPending || summary.count === 0 || !batchVaultId || activeVaults.length === 0}
                onClick={() => saveMutation.mutate()}
                className="flex-[1_1_200px] min-w-0"
              >
                {saveMutation.isPending ? t('saving') : t('saveBatch', summary.count)}
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
              >
                {t('print')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between min-w-0">
            <div className="min-w-0 flex-1">
              <DateFilterBar filter={dateFilter} />
            </div>
            <Button
              type="button"
              size="sm"
              variant={showCancelledBatches ? 'primary' : 'ghost'}
              aria-pressed={showCancelledBatches}
              onClick={() => setShowCancelledBatches((v) => !v)}
              className="shrink-0"
            >
              {showCancelledBatches ? t('hideCancelledBatches') : t('showCancelledBatches')}
            </Button>
          </div>

          <SmartTable
            columns={batchesColumns}
            data={filteredData}
            showRowNumbers
            rowNumberWidth={40}
            tableId="purchases-batches"
            tableLayout="fixed"
            tableMinWidth={1100}
            innerPadding={8}
            total={displayedTotal}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            isLoading={batchesLoading}
            isError={!!batchesError}
            errorMessage={batchesErr?.message || ''}
            footerRow={batchesFooterRow}
            title={t('tabSavedBatches')}
            badge={
              <>
                <span className="text-[12px] text-noorix-muted">— {dateFilter.label}</span>
                <Badge color="blue" size="sm">{t('batchCount', displayedTotal)}</Badge>
              </>
            }
            searchValue={batchSearchInput}
            onSearchChange={(v) => { setBatchSearchInput(v); setPage(1); }}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            emptyMessage={t('noBatchesInPeriod')}
            renderMobileCard={renderBatchMobileCard}
            stripeMobileCards
            stickyActionColumn={false}
          />
        </div>
      )}
        </ScreenTabs>
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
    </ScreenShell>
  );
}
