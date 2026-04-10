/**
 * InvoicesListScreen — قائمة الفواتير
 * يعتمد على: useInvoices | SmartTable | DateFilterBar | format | saudiDate
 */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../hooks/useApiMutation';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useApp }         from '../../context/AppContext';
import { useToast }       from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useInvoices }    from '../../hooks/useInvoices';
import { useSuppliers }   from '../../hooks/useSuppliers';
import { fmt, sumAmounts } from '../../utils/format';
import { formatSaudiDate, formatSaudiDateISO } from '../../utils/saudiDate';
import { updateInvoice, getInvoices, deleteInvoice } from '../../services/api';
import { Badge, Button, Modal, Input, ScreenShell, FmtNum, cn } from '../../ui';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
import SmartTable         from '../../components/common/SmartTable';
import InvoiceActionsCell from '../../components/common/InvoiceActionsCell';
import { InvoiceEditModal } from './components/InvoiceEditModal';
import ImportExportModal  from '../../components/ImportExportModal';
import { formatInvoiceForExport } from '../../utils/importTemplates';
import DayCloseReportModal from './components/DayCloseReportModal';
import { buildActiveCancelledStatusMap, buildInvoiceKindBadgeMap } from '../../constants/badgeMaps';

const PAGE_SIZE = 50;

/* ══ نافذة عرض الفاتورة (قراءة فقط) ══════════════════════════════════════════ */
function InvoiceViewModal({ invoice, onClose, t, lang, fmt }) {
  if (!invoice) return null;
  const fmtDate = (d) => (d ? formatSaudiDate(d) : '—');
  const supplierName = (lang === 'en' ? invoice.supplier?.nameEn || invoice.supplier?.nameAr : invoice.supplier?.nameAr || invoice.supplier?.nameEn) || '—';
  const alloc = invoice.vaultAllocations;
  let vaultSummary = '—';
  if (alloc?.length > 1) {
    vaultSummary = t('invoiceVaultMultiple');
  } else if (alloc?.length === 1) {
    const v = alloc[0].vault;
    vaultSummary = (lang === 'en' ? v?.nameEn || v?.nameAr : v?.nameAr || v?.nameEn) || '—';
  } else if (invoice.vault) {
    vaultSummary = (lang === 'en' ? invoice.vault.nameEn || invoice.vault.nameAr : invoice.vault.nameAr || invoice.vault.nameEn) || '—';
  }
  const fields = [
    { label: t('invoiceNumber'),   value: invoice.supplierInvoiceNumber || invoice.invoiceNumber || '—' },
    { label: t('date'),            value: fmtDate(invoice.transactionDate) },
    { label: t('type'),            value: invoice.kind || '—' },
    { label: t('status'),          value: invoice.status || '—' },
    { label: t('supplier'),        value: supplierName },
    { label: t('invoiceVaultColumn'), value: vaultSummary },
    { label: t('net'),             value: invoice.netAmount != null ? `${fmt(invoice.netAmount)} SR` : '—', highlight: 'var(--noorix-accent-green)' },
    { label: t('tax'),             value: invoice.taxAmount != null ? `${fmt(invoice.taxAmount)} SR` : '—', highlight: 'var(--noorix-accent-amber)' },
    { label: t('total'),           value: invoice.totalAmount != null ? `${fmt(invoice.totalAmount)} SR` : '—', highlight: 'var(--noorix-accent-blue)', bold: true },
  ].filter(Boolean);
  return (
    <Modal open={!!invoice} onClose={onClose} size="sm" hideClose className="nx-modal--flush">
      {/* هيدر بـ gradient */}
      <div className="flex items-center justify-between py-4 px-5" style={{ background: 'linear-gradient(135deg, var(--noorix-accent-blue) 0%, var(--noorix-navy-mid, #1d4ed8) 100%)' }}>
        <div>
          <div className="text-[11px] mb-[3px]" style={{ color: 'rgba(255,255,255,0.75)' }}>{t('invoicesTitle')}</div>
          <h3 className="m-0 font-bold text-[17px]" style={{ color: 'var(--noorix-navy-text)' }}>{invoice.supplierInvoiceNumber || invoice.invoiceNumber || '—'}</h3>
        </div>
        <Button className="nx-gradient-close-btn" onClick={onClose}>
          {t('close')}
        </Button>
      </div>
      {/* حقول التفاصيل */}
      <div className="grid grid-cols-2 gap-2.5 p-5">
        {fields.map(({ label, value, highlight, bold }) => (
          <div key={label} className="bg-noorix-bg-muted py-[10px] px-3 rounded-[10px] border border-noorix-border">
            <div className="text-noorix-muted mb-1 text-[10px] uppercase tracking-[0.05em]">{label}</div>
            <div className="text-[14px]" style={{ fontWeight: bold ? 700 : 600, color: highlight || 'var(--noorix-text)', fontFamily: 'var(--noorix-font-numbers)' }}>{value}</div>
          </div>
        ))}
        {alloc?.length > 1 && (
          <div className="bg-noorix-bg-muted col-span-full py-[10px] px-3 rounded-[10px] border border-noorix-border">
            <div className="text-noorix-muted mb-2 text-[10px] uppercase tracking-[0.05em]">{t('invoiceVaultSplitsDetail')}</div>
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {alloc.map((a) => {
                const vn = lang === 'en' ? a.vault?.nameEn || a.vault?.nameAr : a.vault?.nameAr || a.vault?.nameEn;
                return (
                  <li key={a.id} className="flex justify-between gap-2 text-[13px] text-noorix-text">
                    <span className="truncate">{vn || '—'}</span>
                    <span className="ltr font-semibold shrink-0"><FmtNum n={a.amount} /> <span className="nx-sar">SR</span></span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {invoice.notes && (
          <div className="bg-noorix-bg-muted col-span-full py-[10px] px-3 rounded-[10px] border border-noorix-border">
            <div className="text-noorix-muted mb-1 text-[10px] uppercase tracking-[0.05em]">{t('notes')}</div>
            <div className="text-[13px] text-noorix-text">{invoice.notes}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function InvoicesListScreen() {
  const { activeCompanyId, userRole } = useApp();
  const { t, lang } = useTranslation();
  const [searchParams] = useSearchParams();
  const urlDrillKeyRef = useRef('');
  const companyId           = activeCompanyId ?? '';
  const dateFilter          = useDateFilter();
  const queryClient         = useQueryClient();
  const { showToast }       = useToast();
  const [editingInvoice, setEditingInvoice]   = useState(null);
  const [viewingInvoice, setViewingInvoice]   = useState(null);
  const [filterKind, setFilterKind] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [urlExtra, setUrlExtra] = useState({ kind: '', categoryId: '', expenseLineId: '' });
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('transactionDate');
  const [sortDir, setSortDir] = useState('desc');
  const [showImportExport, setShowImportExport] = useState(false);
  const [dayCloseOpen, setDayCloseOpen] = useState(false);
  const qInit = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('q') || '') : '';
  const [searchText, setSearchText] = useState(qInit);
  const debouncedQ = useDebouncedValue((searchText || '').trim(), 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, dateFilter.startDate, dateFilter.endDate, filterKind, filterSupplierId, showCancelled, urlExtra.kind, urlExtra.categoryId, urlExtra.expenseLineId]);

  useEffect(() => {
    const keys = ['from', 'to', 'kind', 'supplierId', 'categoryId', 'expenseLineId', 'q'];
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
    const kind = searchParams.get('kind') || '';
    const supplierId = searchParams.get('supplierId') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const expenseLineId = searchParams.get('expenseLineId') || '';
    const q = searchParams.get('q') || '';
    if (from && to) {
      dateFilter.setMode('range');
      dateFilter.setRangeStart(from.slice(0, 10));
      dateFilter.setRangeEnd(to.slice(0, 10));
    }
    if (kind) {
      if (kind.includes(',')) {
        setFilterKind('');
        setUrlExtra((p) => ({ ...p, kind }));
      } else {
        setFilterKind(kind);
        setUrlExtra((p) => ({ ...p, kind: '' }));
      }
    }
    if (supplierId) setFilterSupplierId(supplierId);
    if (categoryId) setUrlExtra((p) => ({ ...p, categoryId }));
    if (expenseLineId) setUrlExtra((p) => ({ ...p, expenseLineId }));
    if (q) {
      setSearchText(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- نقرأ فقط دوال فلتر التاريخ المستقرة
  }, [searchParams]);

  const STATUS_MAP = useMemo(() => buildActiveCancelledStatusMap(t), [t]);
  const KIND_MAP = useMemo(() => buildInvoiceKindBadgeMap(t), [t]);

  const deleteInvoiceMut = useApiMutation({
    mutationFn: ({ id }) => deleteInvoice(id, companyId),
    invalidateQueries: [['invoices'], ['vaults'], ['ledger']],
    successToast: () => t('invoiceDeleted'),
    errorToast: (e) => e?.message || t('deleteFailed'),
  });

  const confirmAndDeleteInvoice = useCallback((r) => {
    if (!confirm(t('deleteInvoiceConfirm', r.invoiceNumber || ''))) return;
    deleteInvoiceMut.mutate({ id: r.id });
  }, [t, deleteInvoiceMut]);

  const columns = useMemo(() => [
    { key: 'invoiceNumber', label: t('documentNumber'), shrink: true, width: '11%',
      render: (v) => <span className="nx-cell-num nx-cell-accent nx-cell-ellipsis" title={v || ''}>{v || '—'}</span> },
    { key: 'supplierInvoiceNumber', label: t('supplierInvoiceNumber'), shrink: true, width: '9%',
      render: (v) => <span className="nx-cell-num nx-cell-muted nx-cell-ellipsis" title={v || ''}>{v || '—'}</span> },
    { key: 'supplierName',  label: t('supplier'), width: '10%',
      render: (v) => <span className="nx-cell-ellipsis" title={v || ''}>{v || '—'}</span> },
    { key: 'notesOrEmployee', label: t('invoiceNotesColumn') || 'ملاحظة', width: '10%',
      render: (_, row) => <span className="nx-cell-ellipsis" title={row.notes || ''}>{row.notes || '—'}</span> },
    { key: 'kind',          label: t('type'), shrink: true, width: '5%',
      render: (v) => <Badge {...Badge.fromStatus(v, KIND_MAP)} size="sm" /> },
    { key: 'vaultLabel', label: t('invoiceVaultColumn'), width: '22%',
      render: (_, row) => {
        const a = row.vaultAllocations;
        if (a?.length > 0) {
          return (
            /* flex-nowrap: الشرائح في صف واحد دائماً — overflow-hidden يقطع ما يزيد */
            <div className="flex flex-nowrap gap-1.5 justify-end overflow-hidden">
              {a.map((al) => {
                const vn = lang === 'en' ? al.vault?.nameEn || al.vault?.nameAr : al.vault?.nameAr || al.vault?.nameEn;
                return (
                  <div
                    key={al.id}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-noorix-border',
                      'bg-noorix-bg-muted/90 px-2 py-1 shadow-sm',
                    )}
                    title={vn ? `${vn} — ${fmt(al.amount)} SR` : ''}
                  >
                    <span className="truncate text-[11px] font-semibold text-noorix-text max-w-[60px]">{vn || '—'}</span>
                    <span dir="ltr" className="shrink-0 whitespace-nowrap text-[12px] font-bold tabular-nums text-nx-sales">
                      <FmtNum n={al.amount} /> <span className="nx-sar">SR</span>
                    </span>
                  </div>
                );
              })}
            </div>
          );
        }
        const vn = row.vault
          ? (lang === 'en' ? row.vault.nameEn || row.vault.nameAr : row.vault.nameAr || row.vault.nameEn)
          : '';
        return <span className="nx-cell-ellipsis text-[12px]" title={vn || ''}>{vn || '—'}</span>;
      },
    },
    { key: 'netAmount',     label: t('net'),    numeric: true, shrink: true, width: '5%',
      render: (v) => <FmtNum n={v} className="nx-cell-num nx-cell-num--green" /> },
    { key: 'taxAmount',     label: t('tax'),    numeric: true, shrink: true, width: '4%',
      render: (v) => <FmtNum n={v} className="nx-cell-num nx-cell-num--amber" /> },
    { key: 'totalAmount',   label: t('total'),  numeric: true, shrink: true, width: '7%',
      render: (v) => <FmtNum n={v} className="nx-cell-num nx-cell-bold" /> },
    { key: 'transactionDate', label: t('date'), sortable: true, shrink: true, width: '6%',
      render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDateISO(v)}</span> },
    { key: 'status',        label: t('statusLabel'), shrink: true, width: '5%',
      render: (v) => <Badge {...Badge.fromStatus(v, STATUS_MAP)} size="sm" /> },
    { key: 'actions', label: t('actions'), align: 'center', width: '6%', shrink: true,
      render: (_, row) => (
        <InvoiceActionsCell
          row={row}
          userRole={userRole}
          companyId={companyId}
          onView={(r) => setViewingInvoice(r)}
          onPrint={() => window.print()}
          onEdit={(r) => setEditingInvoice(r)}
          onDelete={confirmAndDeleteInvoice}
        />
      ),
    },
  ], [userRole, companyId, t, lang, STATUS_MAP, KIND_MAP, confirmAndDeleteInvoice, fmt]);

  const { suppliers } = useSuppliers(companyId);

  const dayCloseDefaultYmd = useMemo(
    () => (dateFilter.endDate || dateFilter.startDate || '').slice(0, 10),
    [dateFilter.endDate, dateFilter.startDate],
  );

  const kindForApi = filterKind || urlExtra.kind || undefined;

  const { items, total, sums, inflowByVault, outflowSummary, isLoading, isError, error } = useInvoices({
    companyId,
    startDate: dateFilter.startDate,
    endDate:   dateFilter.endDate,
    page,
    pageSize:  PAGE_SIZE,
    kind: kindForApi,
    supplierId: filterSupplierId || undefined,
    sortBy: sortKey,
    sortDir,
    q: debouncedQ || undefined,
    categoryId: urlExtra.categoryId || undefined,
    expenseLineId: urlExtra.expenseLineId || undefined,
    includeCancelled: showCancelled,
  });

  // بيانات مُحوَّلة لـ SmartTable
  const tableData = useMemo(() => (items || []).map((inv) => ({
    ...inv,
    supplierName: inv.kind === 'sale' ? (t('categoryTypeSale') || 'مبيعات') : (lang === 'en' ? (inv.supplier?.nameEn || inv.supplier?.nameAr || '') : (inv.supplier?.nameAr || inv.supplier?.nameEn || '')),
    notesOrEmployee: inv.notes || '',
  })), [items, t]);

  const activeOnly      = tableData.filter((inv) => inv.status !== 'cancelled');
  const displayedTotal  = total || 0;

  const toggleSort = (key) => {
    if (key !== 'transactionDate') return;
    setPage(1);
    setSortKey('transactionDate');
    setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  // المجاميع الحقيقية من السيرفر (كل النتائج المُفلترة، ليس الصفحة فقط)
  const serverAll     = sums.all;
  const serverInflow  = sums.inflow;
  const serverOutflow = sums.outflow;

  const vaultRowLabel = useCallback((row) => {
    if (row.unassigned) return t('invoicesSalesUnassignedVault');
    const n = lang === 'en' ? (row.nameEn || row.nameAr) : (row.nameAr || row.nameEn);
    return n || '—';
  }, [t, lang]);

  const footerCells = (
    <>
      <td colSpan={7} className="nx-tfoot-label text-[12px]">
        {t('totalInvoices', serverAll.count)} {total > PAGE_SIZE && <span className="text-[11px]" style={{ opacity: 0.65 }}>({t('allPages')})</span>}
      </td>
      <td className="nx-tfoot-num nx-cell-num--green"><FmtNum n={Number(serverAll.net)} /></td>
      <td className="nx-tfoot-num nx-cell-num--amber"><FmtNum n={Number(serverAll.tax)} /></td>
      <td className="nx-tfoot-num nx-cell-num--violet"><FmtNum n={Number(serverAll.total)} /></td>
      <td colSpan={3} />
    </>
  );

  const renderMobileCard = useCallback((row) => (
    <div>
      <div className="nx-mc__header">
        <span className="nx-cell-num nx-cell-accent text-[14px]">
          {row.invoiceNumber || '—'}
        </span>
        <div className="nx-mc__meta">
          <span className="nx-cell-muted-sm">{formatSaudiDateISO(row.transactionDate)}</span>
          <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} size="sm" />
        </div>
      </div>
      <div className="flex items-center gap-8 text-[13px] mb-2">
        <Badge {...Badge.fromStatus(row.kind, KIND_MAP)} size="sm" />
        {row.supplierName && <span className="nx-cell-muted">{row.supplierName}</span>}
      </div>
      <div className="mb-2">
        <div className="text-[10px] font-bold text-noorix-muted mb-1">{t('invoiceVaultColumn')}</div>
        {row.vaultAllocations?.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {row.vaultAllocations.map((al) => {
              const vn = lang === 'en' ? al.vault?.nameEn || al.vault?.nameAr : al.vault?.nameAr || al.vault?.nameEn;
              return (
                <div
                  key={al.id}
                  className={cn(
                    'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-noorix-border',
                    'bg-noorix-bg-muted/90 px-2 py-1 shadow-sm',
                  )}
                >
                  <span className="min-w-0 truncate text-[11px] font-semibold text-noorix-text">{vn || '—'}</span>
                  <span dir="ltr" className="shrink-0 text-[12px] font-bold tabular-nums text-nx-sales">
                    <FmtNum n={al.amount} /> <span className="nx-sar">SR</span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[12px] text-noorix-muted">
            {row.vault
              ? (lang === 'en' ? row.vault.nameEn || row.vault.nameAr : row.vault.nameAr || row.vault.nameEn)
              : '—'}
          </div>
        )}
      </div>
      <div className="nx-mc__grid nx-mc__grid--3">
        <div>
          <div className="nx-mc__stat-label">{t('total')}</div>
          <div className="nx-mc__stat-value"><FmtNum n={row.totalAmount} /></div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('net')}</div>
          <div className="nx-mc__stat-value nx-cell-num--green text-[13px]"><FmtNum n={row.netAmount} /></div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('tax')}</div>
          <div className="nx-mc__stat-value nx-cell-num--amber text-[13px]"><FmtNum n={row.taxAmount} /></div>
        </div>
      </div>
      <div className="nx-mc__actions">
        <InvoiceActionsCell
          row={row}
          userRole={userRole}
          companyId={companyId}
          onPrint={() => window.print()}
          onEdit={(r) => setEditingInvoice(r)}
          onDelete={confirmAndDeleteInvoice}
        />
      </div>
    </div>
  ), [KIND_MAP, STATUS_MAP, userRole, companyId, t, lang, confirmAndDeleteInvoice]);

  return (
    <ScreenShell>
      <div>
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('invoicesTitle')}</h1>
      </div>

      <DateFilterBar filter={dateFilter} />

      {!companyId && (
        <div className="noorix-surface-card nx-empty-state">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {editingInvoice && (
        <InvoiceEditModal
          invoice={editingInvoice}
          suppliers={suppliers}
          companyId={companyId}
          onSaved={() => {
            invalidateOnFinancialMutation(queryClient);
            setEditingInvoice(null);
          }}
          onClose={() => setEditingInvoice(null)}
        />
      )}
      {dayCloseOpen && (
        <DayCloseReportModal
          companyId={companyId}
          isOpen={dayCloseOpen}
          onClose={() => setDayCloseOpen(false)}
          defaultDateYmd={dayCloseDefaultYmd}
        />
      )}
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        entityType="invoices"
        companyId={companyId}
        exportFetcher={async () => {
          const kindForExport = filterKind || (urlExtra.kind ? urlExtra.kind.split(',')[0] : '');
          const res = await getInvoices(
            companyId,
            dateFilter.startDate, dateFilter.endDate,
            1, 2000,
            undefined, undefined,
            kindForExport || undefined, undefined, undefined,
            filterSupplierId || undefined, debouncedQ || undefined,
            urlExtra.categoryId || undefined, urlExtra.expenseLineId || undefined,
          );
          return (res?.items ?? []).map(formatInvoiceForExport);
        }}
        onImportSuccess={(count) => {
          invalidateOnFinancialMutation(queryClient);
          showToast(`تم استيراد ${count} فاتورة بنجاح`, 'success');
        }}
      />

      {companyId && (
        <>
          {/* كروت ملخص — نفس ثيم VaultCard */}
          <div className="noorix-exec-card-grid">
            {/* الداخل — المبيعات */}
            <div className="noorix-exec-card noorix-exec-card--inbound flex flex-col">
              <div className="noorix-exec-card__stripe" />
              <div className="noorix-exec-card__header">
                <div className="noorix-exec-card__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M12 19V5M5 12l7-7 7 7"/>
                  </svg>
                </div>
                <span className="noorix-exec-card__title">{t('inbound')} — {t('categoryTypeSale')}</span>
              </div>
              <div className="flex flex-col gap-3 flex-1 min-h-0 w-full px-1 pt-1">
                <div className="text-center pb-3 border-b border-noorix-border/50">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <FmtNum n={Number(serverInflow.total)} className="text-[24px] sm:text-[26px] font-black tabular-nums text-noorix-text leading-none" />
                    <span className="nx-sar text-noorix-muted">SR</span>
                  </div>
                  <div className="text-[11px] text-noorix-muted mt-1">{t('total')}</div>
                </div>
                <div className="text-[11px] font-semibold text-noorix-muted text-center">{t('invoicesInflowByVaultTitle')}</div>
                <div className="flex flex-col gap-1.5">
                  {!inflowByVault?.length ? (
                    <div className="text-center text-[12px] text-noorix-muted py-3 rounded-xl border border-dashed border-noorix-border/60">—</div>
                  ) : (
                    inflowByVault.map((row) => (
                      <div key={row.vaultId} className="flex justify-between items-center gap-3 rounded-xl border border-noorix-border bg-noorix-bg-muted/60 px-3 py-2.5">
                        <span className="text-[12px] font-semibold text-noorix-text truncate min-w-0 text-start">{vaultRowLabel(row)}</span>
                        <span dir="ltr" className="shrink-0 text-[13px] font-bold tabular-nums text-nx-profit">
                          <FmtNum n={Number(row.total)} /> <span className="nx-sar">SR</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="noorix-exec-card__divider mt-2" />
              <div className="noorix-exec-card__footer">
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('validInvoices')}</span>
                  <span className="noorix-exec-card__stat-value">{serverInflow.count}</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('net')}</span>
                  <span className="noorix-exec-card__stat-value"><FmtNum n={Number(serverInflow.net)} /> <span className="nx-sar">SR</span></span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('tax')}</span>
                  <span className="noorix-exec-card__stat-value"><FmtNum n={Number(serverInflow.tax)} /> <span className="nx-sar">SR</span></span>
                </div>
              </div>
            </div>

            {/* الخارج — المشتريات والمصروفات */}
            <div className="noorix-exec-card noorix-exec-card--outbound flex flex-col">
              <div className="noorix-exec-card__stripe" />
              <div className="noorix-exec-card__header">
                <div className="noorix-exec-card__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M12 5v14M5 12l7 7 7-7"/>
                  </svg>
                </div>
                <span className="noorix-exec-card__title">{t('outbound')} — {t('purchases')} / {t('categoryTypeExpense')}</span>
              </div>
              <div className="flex flex-col gap-3 flex-1 min-h-0 w-full px-1 pt-1">
                <div className="text-center pb-3 border-b border-noorix-border/50">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <FmtNum n={Number(serverOutflow.total)} className="text-[24px] sm:text-[26px] font-black tabular-nums text-noorix-text leading-none" />
                    <span className="nx-sar text-noorix-muted">SR</span>
                  </div>
                  <div className="text-[11px] text-noorix-muted mt-1">{t('total')}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center gap-3 rounded-xl border border-noorix-border bg-noorix-bg-muted/60 px-3 py-2.5">
                    <span className="text-[12px] font-semibold text-noorix-text truncate min-w-0 text-start">{t('purchases')}</span>
                    <span dir="ltr" className="shrink-0 text-[13px] font-bold tabular-nums text-nx-purchases">
                      <FmtNum n={Number(outflowSummary.purchasesTotal)} /> <span className="nx-sar">SR</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3 rounded-xl border border-noorix-border bg-noorix-bg-muted/60 px-3 py-2.5">
                    <span className="text-[12px] font-semibold text-noorix-text truncate min-w-0 text-start">{t('invoicesCardNonPurchaseOutflow')}</span>
                    <span dir="ltr" className="shrink-0 text-[13px] font-bold tabular-nums text-nx-expenses">
                      <FmtNum n={Number(outflowSummary.expensesTotal)} /> <span className="nx-sar">SR</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3 rounded-xl border border-noorix-border bg-noorix-bg-muted/60 px-3 py-2.5">
                    <span className="text-[12px] font-semibold text-noorix-text truncate min-w-0 text-start">{t('tax')}</span>
                    <span dir="ltr" className="shrink-0 text-[13px] font-bold tabular-nums text-noorix-amber">
                      <FmtNum n={Number(outflowSummary.taxTotal)} /> <span className="nx-sar">SR</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="noorix-exec-card__divider mt-2" />
              <div className="noorix-exec-card__footer">
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('validInvoices')}</span>
                  <span className="noorix-exec-card__stat-value">{serverOutflow.count}</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('net')}</span>
                  <span className="noorix-exec-card__stat-value"><FmtNum n={Number(serverOutflow.net)} /> <span className="nx-sar">SR</span></span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('tax')}</span>
                  <span className="noorix-exec-card__stat-value"><FmtNum n={Number(serverOutflow.tax)} /> <span className="nx-sar">SR</span></span>
                </div>
              </div>
            </div>
          </div>
          {(urlExtra.categoryId || urlExtra.expenseLineId || urlExtra.kind) && (
            <div
            className="noorix-surface-card flex items-center justify-between flex-wrap gap-3 text-[12px] py-[10px] px-[14px] border border-dashed border-[var(--noorix-blue-35)] bg-[var(--noorix-blue-4)]"
            >
              <span className="nx-cell-muted">{t('invoicesDrillBanner')}</span>
              <Button size="sm" onClick={() => { setUrlExtra({ kind: '', categoryId: '', expenseLineId: '' }); setPage(1); }}>
                {t('clearDrillFilters')}
              </Button>
            </div>
          )}
          <div className="noorix-exec-filters noorix-exec-filters--scroll">
            <Button
              size="sm"
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
              onClick={() => setDayCloseOpen(true)}
            >
              {t('dayCloseOpenBtn')}
            </Button>
            <Button
              size="sm"
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
              onClick={() => setShowImportExport(true)}
            >
              {t('importExportLabel')}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCancelled((v) => !v)}
              style={showCancelled ? { color: 'var(--noorix-accent-red)', borderColor: 'var(--noorix-red-25)', background: 'var(--noorix-red-6)' } : undefined}
            >
              {showCancelled ? t('hideCancelledInvoices') : t('showCancelledInvoices')}
            </Button>
            <span className="noorix-exec-filters__icon" title={t('filterByType')} aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="4 2 20 2 14 10 14 22 10 22 10 10 4 2"/></svg>
            </span>
            <Input
              type="select"
              value={filterKind}
              onChange={(e) => { setFilterKind(e.target.value); setUrlExtra((p) => ({ ...p, kind: '' })); setPage(1); }}
              className="noorix-exec-filters__select"
            >
              <option value="">{t('filterAllTypes')}</option>
              <option value="purchase">{t('categoryTypes')}</option>
              <option value="expense">{t('categoryTypeExpense')}</option>
              <option value="fixed_expense">{t('fixedExpenseType')}</option>
              <option value="hr_expense">{t('invoiceKindHrExpense')}</option>
              <option value="salary">{t('totalSalary')}</option>
              <option value="advance">{t('quickAdvance')}</option>
              <option value="sale">{t('categoryTypeSale')}</option>
            </Input>
            <Input
              type="select"
              value={filterSupplierId}
              onChange={(e) => { setFilterSupplierId(e.target.value); setPage(1); }}
              className="noorix-exec-filters__select"
            >
              <option value="">{t('allSuppliers')}</option>
              {(suppliers || []).map((s) => (
                <option key={s.id} value={s.id}>{(lang === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn) || s.id}</option>
              ))}
            </Input>
          </div>
          {/* ── عرض الفاتورة (قراءة فقط) ── */}
        {viewingInvoice && (
          <InvoiceViewModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} t={t} lang={lang} fmt={fmt} />
        )}
        <SmartTable
          compact
          showRowNumbers
          tableLayout="fixed"
          rowNumberWidth="1%"
          innerPadding={8}
          getRowClassName={(row) => row.status === 'cancelled' ? 'noorix-row-cancelled' : ''}
          columns={columns}
          data={tableData}
          total={displayedTotal}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          isLoading={isLoading}
          isError={isError}
          errorMessage={error?.message || t('loadInvoicesFailed')}
          footerCells={footerCells}
          title={t('invoicesTitle')}
          badge={
            <>
              <span className="nx-cell-muted-sm">— {dateFilter.label}</span>
              <span className="nx-pill nx-pill--blue nx-pill--sm">{t('invoiceCount', displayedTotal)}</span>
            </>
          }
          searchValue={searchText}
          onSearchChange={setSearchText}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          emptyMessage={t('noInvoicesInPeriod')}
          renderMobileCard={renderMobileCard}
        />
        </>
      )}
    </ScreenShell>
  );
}
